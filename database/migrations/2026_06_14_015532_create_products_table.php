<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_category_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('slug')->unique();
            $table->string('sku')->unique();
            $table->string('brand')->nullable();
            $table->decimal('price', 10, 2)->nullable();
            $table->integer('stock')->default(100);
            $table->string('image')->nullable();           // primary thumbnail (relative path)
            $table->json('gallery')->nullable();           // array of image paths
            $table->text('description')->nullable();       // short summary; may be empty for imports
            $table->json('features')->nullable();          // bullet list
            $table->json('specifications')->nullable();    // key/value spec sheet
            $table->json('faq')->nullable();               // [{question, answer}, ...]
            $table->string('default_color')->nullable();
            $table->json('color_variants')->nullable();    // [{label, swatch, gallery[]}]
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index('brand');
            $table->index('is_active');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('products');
    }
};
