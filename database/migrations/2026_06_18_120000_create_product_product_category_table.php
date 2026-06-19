<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_product_category', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')
                ->constrained()
                ->cascadeOnDelete();
            $table->foreignId('product_category_id')
                ->constrained()
                ->cascadeOnDelete();
            $table->timestamps();

            // A product can only appear in a given category once.
            $table->unique(['product_id', 'product_category_id']);
        });

        // Backfill: every product's existing primary category becomes a pivot row,
        // so category listing pages return the same set of products immediately
        // after the migration as they did before it.
        $rows = DB::table('products')
            ->whereNotNull('product_category_id')
            ->get(['id', 'product_category_id'])
            ->map(fn ($r) => [
                'product_id' => $r->id,
                'product_category_id' => $r->product_category_id,
                'created_at' => now(),
                'updated_at' => now(),
            ])
            ->all();

        if (! empty($rows)) {
            // Chunk to avoid placeholder limits on large catalogs.
            foreach (array_chunk($rows, 500) as $chunk) {
                DB::table('product_product_category')->insert($chunk);
            }
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('product_product_category');
    }
};
