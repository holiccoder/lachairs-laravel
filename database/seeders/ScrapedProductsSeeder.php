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

class ScrapedProductsSeeder extends Seeder
{
    protected string $sourceRoot;
    protected string $publicImagesRoot;

    public function run(): void
    {
        $this->bootPaths();

        if (! File::isDirectory($this->sourceRoot)) {
            $this->command?->warn("Source directory not found: {$this->sourceRoot}");

            return;
        }

        File::ensureDirectoryExists($this->publicImagesRoot);

        $directories = File::directories($this->sourceRoot);

        $categoriesImported = 0;
        $totalImported = 0;
        $totalDeleted = 0;
        $totalSkipped = 0;

        foreach ($directories as $directory) {
            $stats = $this->importDirectory($directory, $categoriesImported);

            $totalImported += $stats['imported'];
            $totalDeleted += $stats['deleted'];
            $totalSkipped += $stats['skipped'];
        }

        $this->command?->info("All done — categories: {$categoriesImported}, imported: {$totalImported}, deleted: {$totalDeleted}, skipped: {$totalSkipped}");
    }

    /**
     * Import every JSON file in the given scripts/output/<slug> directory
     * into the matching ProductCategory (matched/created by directory slug).
     *
     * @param  string|null  $categorySlug  Override the target category slug
     *                                     (defaults to the directory basename).
     *                                     Useful when the source folder doesn't
     *                                     line up with where the products belong.
     * @param  array<int, string>  $only  Restrict to a subset of JSON
     *                                    filenames (without extension).
     *                                    Empty array = import everything.
     * @param  bool  $skipExisting  When true, leave products that already exist
     *                              (matched by slug) untouched instead of
     *                              updating them. The existence check runs
     *                              before any image download.
     * @return array{imported: int, deleted: int, skipped: int}
     */
    public function importDirectory(
        string $directory,
        int &$categoriesImported = 0,
        ?string $categorySlug = null,
        array $only = [],
        bool $skipExisting = false
    ): array {
        $this->bootPaths();

        File::ensureDirectoryExists($this->publicImagesRoot);

        $categorySlug = $categorySlug ?? basename($directory);
        $categoryName = $this->slugToName($categorySlug);

        $category = ProductCategory::firstOrCreate(
            ['slug' => $categorySlug],
            [
                'name' => $categoryName,
                'is_active' => true,
            ]
        );

        if ($category->wasRecentlyCreated) {
            $categoriesImported++;
            $this->command?->info("Created category: {$categoryName}");
        } else {
            $this->command?->info("Using existing category: {$category->name}");
        }

        $files = File::files($directory);
        $imported = 0;
        $deleted = 0;
        $skipped = 0;

        foreach ($files as $file) {
            if ($file->getExtension() !== 'json') {
                continue;
            }

            $slug = $file->getFilenameWithoutExtension();

            if (! empty($only) && ! in_array($slug, $only, true)) {
                continue;
            }

            $raw = File::get($file->getPathname());
            $data = json_decode($raw, true);

            if (! is_array($data) || empty($data['title'])) {
                $this->command?->warn("Skipping invalid JSON: {$file->getFilename()}");
                $skipped++;
                continue;
            }

            $cleanTitle = BrandSanitizer::clean($data['title']);
            $titleSlug = Str::slug($cleanTitle);
            if ($titleSlug === '') {
                $titleSlug = $slug;
            }

            // In skip mode, bail before downloading images if a product with
            // this slug already exists — re-imports neither overwrite the row
            // nor re-fetch its images.
            if ($skipExisting && Product::where('slug', $titleSlug)->exists()) {
                $this->command?->info("  Skipping existing: {$cleanTitle}");
                $skipped++;
                continue;
            }

            $productImageDir = $this->publicImagesRoot.DIRECTORY_SEPARATOR.$titleSlug;
            File::ensureDirectoryExists($productImageDir);

            $urlMap = [];

            $localizeList = function (array $urls) use (&$urlMap, $productImageDir, $titleSlug): array {
                $out = [];
                foreach ($urls as $url) {
                    if (! is_string($url) || $url === '') {
                        continue;
                    }
                    if (! Str::startsWith($url, ['http://', 'https://'])) {
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

            // Resolve SKU collisions across distinct slugs by suffixing.
            $skuOwner = Product::where('sku', $sku)->where('slug', '!=', $titleSlug)->first();
            if ($skuOwner !== null) {
                $sku = $sku.'-'.strtoupper(substr(md5($titleSlug), 0, 6));
            }

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
                    ]
                );
            });

            $imported++;
            $this->command?->info("  Imported: {$cleanTitle}");
        }

        $this->command?->info("Category {$categorySlug} done — imported: {$imported}, deleted: {$deleted}, skipped: {$skipped}");

        return [
            'imported' => $imported,
            'deleted' => $deleted,
            'skipped' => $skipped,
        ];
    }

    protected function bootPaths(): void
    {
        $this->sourceRoot = base_path('scripts/output');
        $this->publicImagesRoot = public_path('images/products');
    }

    protected function slugToName(string $slug): string
    {
        return Str::title(str_replace('-', ' ', $slug));
    }

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
                $this->command?->warn("    download failed ({$response->status()}): {$url}");

                return null;
            }

            $body = $response->body();
            if (strlen($body) === 0) {
                return null;
            }

            File::put($absolutePath, $body);

            return $relativePath;
        } catch (\Throwable $e) {
            $this->command?->warn("    download error: {$url} — {$e->getMessage()}");

            return null;
        }
    }

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

        $clean = preg_replace('/[^0-9.]/', '', $raw);

        return $clean === '' ? null : (float) $clean;
    }
}
