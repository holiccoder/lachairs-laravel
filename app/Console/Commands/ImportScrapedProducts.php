<?php

namespace App\Console\Commands;

use Database\Seeders\ScrapedProductsSeeder;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;

/**
 * Imports products from one or more `scripts/output/<slug>/` directories
 * using the same logic as ScrapedProductsSeeder, but scoped to the
 * directories you name.
 *
 * By default each directory's slug is matched against ProductCategory
 * (existing categories are reused; new ones are created). Use --category
 * to send a directory's products into a different category — handy when
 * the source folder name doesn't line up with where products belong.
 * Use --only to restrict to specific JSON filenames (without .json).
 *
 * Examples:
 *   php artisan products:import resin-cross-back-chairs
 *   php artisan products:import resin-cross-back-chairs wood-cross-back-chairs
 *   php artisan products:import bamboo-chairs --category=bamboo-folding-chairs --only=bamboo-folding-chair-stick-back
 */
class ImportScrapedProducts extends Command
{
    protected $signature = 'products:import
        {slug* : One or more directory slugs under scripts/output/}
        {--category= : Target category slug (overrides the directory name; applies to every listed directory)}
        {--only=* : Restrict to specific JSON filenames without the .json extension}';

    protected $description = 'Import scraped products from specific scripts/output/<slug>/ directories into matching categories.';

    public function handle(): int
    {
        $slugs = (array) $this->argument('slug');
        $categoryOverride = $this->option('category') ?: null;
        $only = (array) $this->option('only');
        $sourceRoot = base_path('scripts/output');

        $seeder = new ScrapedProductsSeeder();
        $seeder->setCommand($this);

        $categoriesImported = 0;
        $totalImported = 0;
        $totalDeleted = 0;
        $totalSkipped = 0;
        $missing = [];

        foreach ($slugs as $slug) {
            $directory = $sourceRoot.DIRECTORY_SEPARATOR.$slug;

            if (! File::isDirectory($directory)) {
                $this->warn("Skipping unknown directory: scripts/output/{$slug}");
                $missing[] = $slug;
                continue;
            }

            $stats = $seeder->importDirectory($directory, $categoriesImported, $categoryOverride, $only);
            $totalImported += $stats['imported'];
            $totalDeleted += $stats['deleted'];
            $totalSkipped += $stats['skipped'];
        }

        $this->info("Done — categories created: {$categoriesImported}, imported: {$totalImported}, deleted: {$totalDeleted}, skipped: {$totalSkipped}");

        return $missing === [] ? self::SUCCESS : self::FAILURE;
    }
}
