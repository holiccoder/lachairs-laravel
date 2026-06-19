<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ProductCategory extends Model
{
    use HasFactory;

    protected $fillable = [
        'parent_id',
        'name',
        'slug',
        'description',
        'thumbnail',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(self::class, 'parent_id');
    }

    /**
     * All products that appear under this category — this is a many-to-many
     * relation through the `product_product_category` pivot, which contains
     * each product's primary category plus any additional cross-listings.
     */
    public function products(): BelongsToMany
    {
        return $this->belongsToMany(Product::class, 'product_product_category')
            ->withTimestamps();
    }

    /**
     * Products whose canonical/primary category is this one (i.e. their
     * `product_category_id` FK points here). Useful when you specifically need
     * the "home" category set rather than every product cross-listed here.
     */
    public function primaryProducts(): HasMany
    {
        return $this->hasMany(Product::class);
    }

    /**
     * Return this category's id plus every descendant category id (children,
     * grandchildren, …). Used by the catalog so visiting a parent-category
     * URL surfaces every product nested under it, not just the ones pinned
     * directly to that category row.
     *
     * One query against the categories table, tree-walked in PHP. The table
     * has ~37 rows so this is cheap.
     *
     * @return list<int>
     */
    public function descendantIds(): array
    {
        $byParent = self::query()
            ->select(['id', 'parent_id'])
            ->get()
            ->groupBy(fn (self $c) => $c->parent_id ?? 0);

        $ids = [$this->id];
        $stack = [$this->id];
        while ($stack) {
            $current = array_pop($stack);
            foreach ($byParent->get($current, collect()) as $child) {
                $ids[] = $child->id;
                $stack[] = $child->id;
            }
        }

        return $ids;
    }
}
