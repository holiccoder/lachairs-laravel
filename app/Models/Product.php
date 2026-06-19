<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Product extends Model
{
    use HasFactory;

    protected $fillable = [
        'product_category_id',
        'name',
        'slug',
        'sku',
        'brand',
        'price',
        'stock',
        'image',
        'gallery',
        'description',
        'features',
        'specifications',
        'faq',
        'default_color',
        'color_variants',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'price' => 'decimal:2',
            'stock' => 'integer',
            'is_active' => 'boolean',
            'gallery' => 'array',
            'features' => 'array',
            'specifications' => 'array',
            'faq' => 'array',
            'color_variants' => 'array',
        ];
    }

    /**
     * The product's canonical / "primary" category — used for breadcrumbs and the
     * default URL. A product additionally appears in any categories listed via
     * the `categories()` many-to-many pivot.
     */
    public function category(): BelongsTo
    {
        return $this->belongsTo(ProductCategory::class, 'product_category_id');
    }

    /**
     * All categories this product belongs to (primary + cross-listed). The
     * primary category is also kept in this pivot — the boot() observer below
     * keeps that invariant on every save.
     */
    public function categories(): BelongsToMany
    {
        return $this->belongsToMany(ProductCategory::class, 'product_product_category')
            ->withTimestamps();
    }

    protected static function booted(): void
    {
        // Whenever a product is saved, ensure its primary category is also
        // present in the pivot table. Idempotent — duplicate inserts are a
        // no-op thanks to the (product_id, product_category_id) unique index.
        static::saved(function (self $product): void {
            if ($product->product_category_id) {
                $product->categories()->syncWithoutDetaching([$product->product_category_id]);
            }
        });
    }
}
