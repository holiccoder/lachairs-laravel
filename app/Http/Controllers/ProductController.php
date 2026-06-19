<?php

namespace App\Http\Controllers;

use App\Models\Product;
use App\Models\ProductCategory;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ProductController extends Controller
{
    /**
     * Render the products listing / search page.
     *
     * `/products` lists every active product from the DB, paginated 24/page via
     * `?page=`. `/products?q=…` runs a server-side DB search across
     * name/sku/brand/description and paginates the matches the same way. The
     * React Products page reads the `pagination` prop and renders its existing
     * paginator controls — clicking a page reloads via `router.visit` so the
     * server stays the source of truth.
     */
    public function index(Request $request): Response
    {
        $q = trim((string) $request->query('q', ''));
        $perPage = 24;

        $query = Product::with(['category', 'categories'])
            ->where('is_active', true);

        if ($q !== '') {
            $like = '%'.str_replace(['%', '_'], ['\\%', '\\_'], $q).'%';
            $query->where(function ($w) use ($like) {
                $w->where('name', 'like', $like)
                    ->orWhere('sku', 'like', $like)
                    ->orWhere('brand', 'like', $like)
                    ->orWhere('description', 'like', $like);
            });
        }

        $paginator = $query
            ->orderBy('name')
            ->paginate($perPage)
            ->withQueryString();

        $products = $paginator->getCollection()
            ->map(fn (Product $p) => $this->shapeForList($p))
            ->all();

        // Build a DB-backed category lookup so the React filter sidebar can
        // label each category id with its real name (the static JSON map under
        // resources/js/data uses different ids and would otherwise show
        // "Category 38" placeholders for DB-sourced products).
        $categoryNames = ProductCategory::query()
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'slug'])
            ->mapWithKeys(fn (ProductCategory $c) => [
                (string) $c->id => [
                    'name' => $c->name,
                    'slug' => $c->slug,
                    'urlPath' => $c->slug,
                ],
            ]);

        return Inertia::render('Products', [
            'q' => $q !== '' ? $q : null,
            'products' => $products,
            'total' => $paginator->total(),
            'categoryNames' => $categoryNames,
            'pagination' => [
                'currentPage' => $paginator->currentPage(),
                'totalPages' => $paginator->lastPage(),
                'totalItems' => $paginator->total(),
                'pageSize' => $paginator->perPage(),
            ],
        ]);
    }

    /**
     * Render a product detail page from the DB.
     *
     * The frontend Product page also has a static-JSON fallback path for
     * legacy Magento-style url_keys, so if the slug doesn't resolve here we
     * just pass it through and let the client try the static lookup.
     */
    public function show(string $slug): Response
    {
        $product = Product::with(['category', 'categories'])
            ->where('slug', $slug)
            ->where('is_active', true)
            ->first();

        if (! $product) {
            return Inertia::render('Product', ['slug' => $slug]);
        }

        return Inertia::render('Product', [
            'slug' => $slug,
            'product' => $this->transform($product),
        ]);
    }

    /**
     * Lightweight product shape for grid listings (search results, category
     * pages). Mirrors the field names the React Products grid already reads
     * from the static-data transformer.
     */
    protected function shapeForList(Product $product): array
    {
        $thumbPath = $product->image;
        if (! $thumbPath && is_array($product->gallery)) {
            $thumbPath = $product->gallery[0] ?? null;
        }

        // Pull all category memberships (primary + cross-listed) for the grid
        // so client-side filters can match on any of them. Falls back to the
        // primary FK alone if the relation hasn't been loaded.
        $categoryIds = $product->relationLoaded('categories')
            ? $product->categories->pluck('id')->map(fn ($id) => (string) $id)->all()
            : ($product->product_category_id ? [(string) $product->product_category_id] : []);

        return [
            'id' => $product->id,
            'sku' => $product->sku,
            'name' => $product->name,
            'price' => (float) $product->price,
            'urlKey' => $product->slug,
            'typeId' => 'simple',
            'status' => 1,
            'thumbnail' => $thumbPath ? '/'.ltrim($thumbPath, '/') : '',
            'categoryIds' => $categoryIds,
            'category' => $product->category ? [
                'id' => $product->category->id,
                'name' => $product->category->name,
                'slug' => $product->category->slug,
            ] : null,
        ];
    }

    /**
     * Shape a DB product into the structure the React Product page expects.
     * Mirrors the static-data transformer in resources/js/lib/magento.js so
     * the page can render either source without branching, and adds the
     * richer DB-only fields (features, specifications, faq, color variants)
     * that the admin Products form collects.
     */
    protected function transform(Product $product): array
    {
        $gallery = is_array($product->gallery) ? $product->gallery : [];
        if (empty($gallery) && $product->image) {
            $gallery = [$product->image];
        }

        $images = [];
        foreach ($gallery as $i => $path) {
            if (! is_string($path) || $path === '') {
                continue;
            }
            $images[] = [
                'file' => $path,
                'url' => '/'.ltrim($path, '/'),
                // Mark the first entry as primary so the page picks it as the hero shot.
                'types' => $i === 0 ? ['image', 'thumbnail', 'small_image'] : [],
            ];
        }

        $features = array_values(array_filter(
            is_array($product->features) ? $product->features : [],
            fn ($f) => is_string($f) && trim($f) !== '',
        ));

        $specifications = is_array($product->specifications) ? $product->specifications : [];

        $faq = array_values(array_filter(
            is_array($product->faq) ? $product->faq : [],
            fn ($row) => is_array($row)
                && ! empty($row['question'])
                && ! empty($row['answer']),
        ));

        $colorVariants = [];
        foreach (is_array($product->color_variants) ? $product->color_variants : [] as $variant) {
            if (! is_array($variant)) {
                continue;
            }
            $vGallery = array_values(array_filter(
                is_array($variant['gallery'] ?? null) ? $variant['gallery'] : [],
                fn ($p) => is_string($p) && $p !== '',
            ));
            $colorVariants[] = [
                'label' => $variant['label'] ?? null,
                'swatch' => $variant['swatch'] ?? null,
                'gallery' => array_map(fn ($p) => '/'.ltrim($p, '/'), $vGallery),
            ];
        }

        return [
            'id' => $product->id,
            'sku' => $product->sku,
            'name' => $product->name,
            'price' => (float) $product->price,
            'typeId' => 'simple',
            // The seeder leaves stock at 0 for now; treat any active product as
            // in-stock so the CTA stays visible. Tighten this when stock is real.
            'status' => 1,
            'weight' => null,
            'images' => $images,
            'thumbnail' => $images[0]['url'] ?? '',
            'description' => $product->description,
            'urlKey' => $product->slug,
            'categoryIds' => $product->relationLoaded('categories')
                ? $product->categories->pluck('id')->map(fn ($id) => (string) $id)->all()
                : ($product->product_category_id ? [(string) $product->product_category_id] : []),
            'metaTitle' => $product->name,
            'metaDescription' => $product->description,
            'color' => $product->default_color,
            'brand' => $product->brand,
            'countryOfManufacture' => null,
            'hasOptions' => false,
            'configurableOptions' => [],
            'configurableLinks' => [],
            'features' => $features,
            'specifications' => $specifications,
            'faq' => $faq,
            'colorVariants' => $colorVariants,
            'category' => $product->category ? [
                'id' => $product->category->id,
                'name' => $product->category->name,
                'slug' => $product->category->slug,
            ] : null,
        ];
    }
}
