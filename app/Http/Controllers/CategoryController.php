<?php

namespace App\Http\Controllers;

use App\Models\Product;
use App\Models\ProductCategory;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class CategoryController extends Controller
{
    /**
     * Resolve the URL path against categories and products.
     *
     * Order of precedence:
     *   1. The trailing slug matches a DB ProductCategory → category page.
     *   2. Single-segment path whose slug matches a DB Product → product page
     *      (products live at root, so /chairs/foo never resolves as a product).
     *   3. Single-segment path with no DB match → defer to ProductController so
     *      the static-JSON fallback in Product.jsx still renders legacy slugs.
     *   4. Multi-segment path with no category match → static Products listing
     *      (preserves the previous catch-all behavior for legacy category URLs).
     */
    public function show(string $path, ProductController $productController): Response
    {
        $segments = array_values(array_filter(explode('/', $path), fn ($s) => $s !== ''));

        if (empty($segments)) {
            abort(404);
        }

        $slug = $segments[count($segments) - 1];

        $category = ProductCategory::where('slug', $slug)
            ->where('is_active', true)
            ->first();

        if ($category) {
            return $this->renderCategory($category, $segments);
        }

        // Single-segment URLs are product candidates — /{product-slug}.
        if (count($segments) === 1) {
            return $productController->show($slug);
        }

        // Multi-segment with no category match: static-data Products fallback,
        // matching the legacy catch-all behavior.
        return Inertia::render('Products');
    }

    /**
     * @param  list<string>  $segments
     */
    protected function renderCategory(ProductCategory $category, array $segments): Response
    {
        // Pull every product whose primary or cross-listed category sits anywhere
        // in this category's subtree. Visiting a parent (e.g. /stacking-chairs)
        // therefore surfaces products attached to leaf children
        // (banquet-chairs, wood-chiavari-chairs, …) too — not just rows pinned
        // directly to the parent.
        $subtreeIds = $category->descendantIds();

        $products = Product::query()
            ->where('is_active', true)
            ->whereHas('categories', fn ($q) => $q->whereIn('product_categories.id', $subtreeIds))
            ->orderBy('name')
            ->get()
            ->map(fn ($p) => [
                'id' => $p->id,
                'slug' => $p->slug,
                'name' => $p->name,
                'sku' => $p->sku,
                'price' => (float) $p->price,
                'priceFormatted' => '$'.number_format((float) $p->price, 2),
                'image' => $p->image ? '/'.ltrim($p->image, '/') : null,
                // Color swatches for the card. Only variants with at least one
                // gallery image are usable — others have nothing to swap to.
                // `swatch` may be a hex (#ffffff) or an image path; image paths
                // get the same /-prefix as the main `image` above.
                'colors' => collect($p->color_variants ?? [])
                    ->filter(fn ($c) => is_array($c) && ! empty($c['gallery']))
                    ->map(function ($c) {
                        $swatch = $c['swatch'] ?? null;
                        if (is_string($swatch)
                            && $swatch !== ''
                            && ! str_starts_with($swatch, '#')
                            && ! str_starts_with($swatch, 'http')) {
                            $swatch = '/'.ltrim($swatch, '/');
                        }
                        return [
                            'label' => $c['label'] ?? null,
                            'swatch' => $swatch,
                            'image' => '/'.ltrim($c['gallery'][0], '/'),
                        ];
                    })
                    ->values()
                    ->all(),
            ])
            ->all();

        $breadcrumbs = [['label' => 'Home', 'href' => '/']];
        $accum = '';
        foreach ($segments as $i => $seg) {
            $accum .= '/'.$seg;
            $isLast = $i === count($segments) - 1;
            $breadcrumbs[] = [
                'label' => $isLast ? $category->name : Str::headline($seg),
                'href' => $isLast ? null : $accum,
            ];
        }

        return Inertia::render('PlasticFoldingChairs', [
            'category' => [
                'id' => $category->id,
                'name' => $category->name,
                'slug' => $category->slug,
            ],
            'products' => $products,
            'breadcrumbs' => $breadcrumbs,
        ]);
    }
}
