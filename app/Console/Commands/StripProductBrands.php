<?php

namespace App\Console\Commands;

use App\Models\Product;
use App\Support\BrandSanitizer;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;

/**
 * One-off cleanup that strips brand tokens from existing product names and
 * regenerates slugs to match. Re-runnable: products already clean are no-ops.
 *
 * Why this exists separately from the seeder: the seeder is keyed on slug, so
 * if we just re-seed after changing the cleaning rule, old (dirty-slug) rows
 * stay around and new (clean-slug) duplicates appear. This command updates
 * existing rows in place — including their on-disk image folders and the
 * stored image/gallery paths — so a future re-seed lines up cleanly.
 */
class StripProductBrands extends Command
{
    protected $signature = 'products:strip-brands {--dry-run : Show planned changes without writing}';

    protected $description = 'Strip brand fragments (TitanPRO, Zown, …) from product names/slugs and rename their image folders.';

    public function handle(): int
    {
        $dry = (bool) $this->option('dry-run');
        $imageRoot = public_path('images/products');

        // Collect planned changes first so we can detect slug collisions across
        // the whole set before mutating anything. Each entry: id, oldName,
        // newName, oldSlug, newSlug, oldImageDir, newImageDir.
        $plans = [];
        // Track desired slugs already claimed in this batch (plus existing
        // slugs we're not changing) to assign -2/-3 suffixes deterministically.
        $taken = Product::pluck('slug')->all();
        $taken = array_combine($taken, $taken);

        foreach (Product::orderBy('id')->get() as $p) {
            $newName = BrandSanitizer::clean($p->name);
            if ($newName === '') {
                $this->warn("Product {$p->id} ({$p->slug}): name became empty after stripping — skipping.");
                continue;
            }

            $baseSlug = Str::slug($newName);
            if ($baseSlug === '') {
                $this->warn("Product {$p->id} ({$p->slug}): slug became empty after stripping — skipping.");
                continue;
            }

            // Free up the old slug so a -1 collision with self doesn't trigger.
            unset($taken[$p->slug]);

            $newSlug = $baseSlug;
            $suffix = 2;
            while (isset($taken[$newSlug])) {
                $newSlug = $baseSlug.'-'.$suffix++;
            }
            $taken[$newSlug] = $newSlug;

            if ($newName === $p->name && $newSlug === $p->slug) {
                continue;
            }

            $plans[] = [
                'id' => $p->id,
                'oldName' => $p->name,
                'newName' => $newName,
                'oldSlug' => $p->slug,
                'newSlug' => $newSlug,
                'oldImageDir' => $imageRoot.DIRECTORY_SEPARATOR.$p->slug,
                'newImageDir' => $imageRoot.DIRECTORY_SEPARATOR.$newSlug,
            ];
        }

        if (empty($plans)) {
            $this->info('Nothing to do — all product names/slugs already clean.');
            return self::SUCCESS;
        }

        $this->info(($dry ? '[dry-run] ' : '').count($plans).' product(s) to update:');
        foreach ($plans as $plan) {
            $this->line("  #{$plan['id']}");
            $this->line("    name:  {$plan['oldName']}");
            $this->line("        → {$plan['newName']}");
            $this->line("    slug:  {$plan['oldSlug']}");
            $this->line("        → {$plan['newSlug']}");
        }

        if ($dry) {
            return self::SUCCESS;
        }

        $renamed = 0;
        $updated = 0;

        DB::transaction(function () use ($plans, &$renamed, &$updated) {
            foreach ($plans as $plan) {
                // Rename the on-disk image folder if it still matches the old
                // slug. If it doesn't exist, the product was probably uploaded
                // through the admin (paths point at storage/...), nothing to
                // move on disk.
                if ($plan['oldSlug'] !== $plan['newSlug']
                    && File::isDirectory($plan['oldImageDir'])
                    && ! File::exists($plan['newImageDir'])) {
                    File::move($plan['oldImageDir'], $plan['newImageDir']);
                    $renamed++;
                }

                $product = Product::find($plan['id']);
                if (! $product) {
                    continue;
                }

                $rewrite = function (?string $path) use ($plan) {
                    if (! is_string($path) || $path === '') {
                        return $path;
                    }
                    $needle = 'images/products/'.$plan['oldSlug'].'/';
                    $replacement = 'images/products/'.$plan['newSlug'].'/';
                    return str_starts_with($path, $needle)
                        ? $replacement.substr($path, strlen($needle))
                        : $path;
                };

                $product->name = $plan['newName'];
                $product->slug = $plan['newSlug'];
                $product->image = $rewrite($product->image);

                if (is_array($product->gallery)) {
                    $product->gallery = array_map($rewrite, $product->gallery);
                }

                // color_variants is [{label, swatch, gallery: []}, ...] — any
                // path inside there needs the same treatment.
                if (is_array($product->color_variants)) {
                    $product->color_variants = array_map(function ($variant) use ($rewrite) {
                        if (! is_array($variant)) {
                            return $variant;
                        }
                        if (isset($variant['swatch'])) {
                            $variant['swatch'] = $rewrite($variant['swatch']);
                        }
                        if (isset($variant['gallery']) && is_array($variant['gallery'])) {
                            $variant['gallery'] = array_map($rewrite, $variant['gallery']);
                        }
                        return $variant;
                    }, $product->color_variants);
                }

                $product->save();
                $updated++;
            }
        });

        $this->info("Updated {$updated} product(s); renamed {$renamed} image folder(s).");
        return self::SUCCESS;
    }
}
