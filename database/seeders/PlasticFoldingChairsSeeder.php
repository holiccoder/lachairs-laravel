<?php

namespace Database\Seeders;

use App\Models\Product;
use App\Models\ProductCategory;
use App\Support\BrandSanitizer;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class PlasticFoldingChairsSeeder extends Seeder
{
    /**
     * Source directory of scraped product JSONs.
     */
    protected string $sourceDir;

    /**
     * Public/images destination — anything written here is web-servable as /images/...
     */
    protected string $publicImagesRoot;

    /**
     * Slug of the parent category every imported product belongs to.
     */
    protected string $categorySlug = 'plastic-folding-chairs';

    public function run(): void
    {
        $this->sourceDir = base_path('scripts/output/plastic-folding-chairs');
        $this->publicImagesRoot = public_path('images/products');

        if (! File::isDirectory($this->sourceDir)) {
            $this->command?->warn("Source directory not found: {$this->sourceDir}");
            return;
        }

        $category = ProductCategory::where('slug', $this->categorySlug)->first();
        if (! $category) {
            $this->command?->error("Category '{$this->categorySlug}' not found. Run ProductCategorySeeder first.");
            return;
        }

        File::ensureDirectoryExists($this->publicImagesRoot);

        $files = File::files($this->sourceDir);
        $imported = 0;
        $deleted = 0;
        $skipped = 0;

        foreach ($files as $file) {
            if ($file->getExtension() !== 'json') {
                continue;
            }

            $slug = $file->getFilenameWithoutExtension();
            $raw = File::get($file->getPathname());
            $data = json_decode($raw, true);

            if (! is_array($data) || empty($data['title'])) {
                $this->command?->warn("Skipping invalid JSON: {$file->getFilename()}");
                $skipped++;
                continue;
            }

            // Build slug from the title (override the filename slug per the spec).
            // Brand fragments (TitanPRO, Zown, etc.) are stripped before slugging
            // so URLs and display names stay neutral.
            $cleanTitle = BrandSanitizer::clean($data['title']);
            $titleSlug = Str::slug($cleanTitle);
            if ($titleSlug === '') {
                $titleSlug = $slug;
            }

            // Localize images. Gather every URL referenced (default gallery + per-color galleries + swatches),
            // download each one once, and rewrite to the local path.
            $productImageDir = $this->publicImagesRoot.DIRECTORY_SEPARATOR.$titleSlug;
            File::ensureDirectoryExists($productImageDir);

            $urlMap = [];   // remote URL => local relative path (e.g. images/products/slug/foo.jpg)

            $localizeList = function (array $urls) use (&$urlMap, $productImageDir, $titleSlug): array {
                $out = [];
                foreach ($urls as $url) {
                    if (! is_string($url) || $url === '') {
                        continue;
                    }
                    if (! Str::startsWith($url, ['http://', 'https://'])) {
                        // Already local or a swatch hex like '#ffffff' — pass through unchanged.
                        $out[] = $url;
                        continue;
                    }
                    if (isset($urlMap[$url])) {
                        $out[] = $urlMap[$url];
                        continue;
                    }
                    $localPath = $this->downloadImage($url, $productImageDir, $titleSlug);
                    if ($localPath !== null) {
                        $urlMap[$url] = $localPath;
                        $out[] = $localPath;
                    }
                    // null = download failed; silently drop that URL.
                }
                return $out;
            };

            $defaultGallery = $localizeList($data['defaultGallery'] ?? []);

            $colors = [];
            foreach (($data['colors'] ?? []) as $color) {
                $swatch = $color['swatchImage'] ?? null;
                $localSwatch = null;
                if (is_string($swatch) && $swatch !== '') {
                    if (Str::startsWith($swatch, ['http://', 'https://'])) {
                        $localSwatch = $urlMap[$swatch] ?? $this->downloadImage($swatch, $productImageDir, $titleSlug);
                        if ($localSwatch !== null) {
                            $urlMap[$swatch] = $localSwatch;
                        }
                    } else {
                        // Hex or already-local — keep as-is.
                        $localSwatch = $swatch;
                    }
                }

                $gallery = $localizeList($color['gallery'] ?? []);

                $colors[] = [
                    'label' => $color['label'] ?? null,
                    'swatch' => $localSwatch,
                    'gallery' => $gallery,
                ];
            }

            // Per the spec: if a product has no images, don't import it — delete the JSON.
            $hasAnyImage = ! empty($defaultGallery) || collect($colors)->contains(fn ($c) => ! empty($c['gallery']));
            if (! $hasAnyImage) {
                File::deleteDirectory($productImageDir);
                File::delete($file->getPathname());
                $this->command?->warn("Deleted (no images): {$file->getFilename()}");
                $deleted++;
                continue;
            }

            $price = $this->parsePrice($data['price'] ?? null);
            $sku = trim((string) ($data['sku'] ?? '')) ?: 'AUTO-'.strtoupper(Str::random(8));

            // Description = first feature line (the JSONs don't carry a separate description field;
            // features[0] is the lead paragraph and works well as a teaser).
            $features = array_values(array_filter(
                $data['features'] ?? [],
                fn ($f) => is_string($f) && trim($f) !== ''
            ));
            $description = $features[0] ?? null;

            DB::transaction(function () use (
                $titleSlug, $sku, $data, $cleanTitle, $price, $description, $features,
                $defaultGallery, $colors, $category
            ) {
                Product::updateOrCreate(
                    ['slug' => $titleSlug],
                    [
                        'product_category_id' => $category->id,
                        'name' => $cleanTitle,
                        'sku' => $sku,
                        'brand' => $data['brand'] ?? null,
                        'price' => $price,
                        'stock' => 100,
                        'image' => $defaultGallery[0] ?? null,
                        'gallery' => $defaultGallery,
                        'description' => $description,
                        'features' => $features,
                        'specifications' => $data['specifications'] ?? null,
                        'faq' => $data['faq'] ?? null,
                        'default_color' => $data['defaultColor'] ?? null,
                        'color_variants' => $colors,
                        'is_active' => true,
                    ],
                );
            });

            $imported++;
            $this->command?->info("Imported: {$cleanTitle}");
        }

        $this->command?->info("Done — imported: {$imported}, deleted (no images): {$deleted}, skipped: {$skipped}");
    }

    /**
     * Download a remote image to the product's local folder. Returns the
     * web-relative path (e.g. images/products/foo/bar.jpg) on success,
     * or null on any failure so callers can drop the URL.
     */
    protected function downloadImage(string $url, string $productImageDir, string $slug): ?string
    {
        try {
            $extension = $this->extractExtension($url);
            $hash = substr(md5($url), 0, 12);
            $filename = $hash.'.'.$extension;
            $absolutePath = $productImageDir.DIRECTORY_SEPARATOR.$filename;
            $relativePath = 'images/products/'.$slug.'/'.$filename;

            if (File::exists($absolutePath) && File::size($absolutePath) > 0) {
                return $relativePath;
            }

            $response = Http::timeout(20)
                ->withUserAgent('Mozilla/5.0 (compatible; LachairsImporter/1.0)')
                ->get($url);

            if (! $response->successful()) {
                $this->command?->warn("  download failed ({$response->status()}): {$url}");
                return null;
            }

            $body = $response->body();
            if (strlen($body) === 0) {
                return null;
            }

            File::put($absolutePath, $body);
            return $relativePath;
        } catch (\Throwable $e) {
            $this->command?->warn("  download error: {$url} — {$e->getMessage()}");
            return null;
        }
    }

    /**
     * Pull a sane file extension from a URL. Falls back to jpg.
     */
    protected function extractExtension(string $url): string
    {
        $path = parse_url($url, PHP_URL_PATH) ?: '';
        $extension = strtolower(pathinfo($path, PATHINFO_EXTENSION));
        $allowed = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
        return in_array($extension, $allowed, true) ? $extension : 'jpg';
    }

    protected function parsePrice(?string $raw): ?float
    {
        if ($raw === null || $raw === '') {
            return null;
        }
        // Strip $ and commas, e.g. "$1,299.00" -> 1299.00
        $clean = preg_replace('/[^0-9.]/', '', $raw);
        return $clean === '' ? null : (float) $clean;
    }
}
