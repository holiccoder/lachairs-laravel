<?php

namespace Database\Seeders;

use App\Models\ProductCategory;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;

class ProductCategorySeeder extends Seeder
{
    /**
     * Slugs collected from public/js/menu.json during a sync run.
     *
     * @var array<int, string>
     */
    protected array $seenSlugs = [];

    /**
     * Sync product categories with public/js/menu.json:
     *  - upsert every node by slug, threading parent_id through the tree
     *  - delete any existing category whose slug is no longer in the JSON
     */
    public function run(): void
    {
        $path = public_path('js/menu.json');

        if (! File::exists($path)) {
            $this->command?->warn("menu.json not found at {$path} — skipping ProductCategorySeeder.");

            return;
        }

        $items = json_decode(File::get($path), true);

        if (! is_array($items)) {
            $this->command?->warn('menu.json is not a valid JSON array — skipping ProductCategorySeeder.');

            return;
        }

        DB::transaction(function () use ($items): void {
            $this->seenSlugs = [];

            // First pass: upsert every node from the JSON.
            $this->seedItems($items, null);

            // Second pass: drop categories that disappeared from the JSON.
            // The products FK cascades on delete, so refuse to prune any category
            // that still has products attached — surface it instead.
            $stale = ProductCategory::query()
                ->whereNotIn('slug', $this->seenSlugs)
                ->withCount('products')
                ->get();

            foreach ($stale as $category) {
                if ($category->products_count > 0) {
                    $this->command?->warn(
                        "Skipping prune of '{$category->slug}' — {$category->products_count} product(s) still attached. ".
                        'Reassign them in admin before re-seeding.'
                    );

                    continue;
                }

                $category->delete();
            }
        });
    }

    /**
     * @param  array<int, array<string, mixed>>  $items
     */
    protected function seedItems(array $items, ?int $parentId): void
    {
        foreach ($items as $item) {
            if (empty($item['label'])) {
                continue;
            }

            $name = (string) $item['label'];
            $slug = (string) ($item['slug'] ?? Str::slug($name));

            $category = ProductCategory::updateOrCreate(
                ['slug' => $slug],
                [
                    'parent_id' => $parentId,
                    'name' => $name,
                    'is_active' => true,
                ],
            );

            $this->seenSlugs[] = $slug;

            if (! empty($item['children']) && is_array($item['children'])) {
                $this->seedItems($item['children'], $category->id);
            }
        }
    }
}
