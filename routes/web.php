<?php

use App\Http\Controllers\CategoryController;
use App\Http\Controllers\ContactController;
use App\Http\Controllers\NewsletterController;
use App\Http\Controllers\OrderController;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\RegistrationController;
use App\Models\ProductCategory;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', function () {
    // Homepage "Explore Our Categories" grid. Pull every active category and
    // attach a representative thumbnail (first product image, when available)
    // so the React page can render them with no further fetching.
    //
    // Several categories are hidden from this grid (the top-level "chairs" /
    // "tables" buckets are too generic — visitors get sent to the more specific
    // child categories — and the parts/covers/cushions/dollies categories are
    // accessories that don't earn a top-of-funnel slot). They remain active in
    // the catalog and admin.
    $hiddenFromHome = [
        'chairs',
        'tables',
        'folding-chairs',
        'wood-tables',
        'bamboo-chairs',
        'bamboo-folding-chairs',
        'tablecloths-and-covers',
        'chairs-covers-and-cushions-and-tablecloths',
        'dollies-and-parts',
        'folding-chairs-cushions-and-covers',
        'folding-chairs-parts-and-dollies',
        'stacking-chairs-cushions-and-covers',
        'stacking-chairs-parts-and-dollies',
        'table-parts-and-dollies',
    ];

    $categories = ProductCategory::query()
        ->where('is_active', true)
        ->whereNotIn('slug', $hiddenFromHome)
        ->orderBy('name')
        ->get()
        ->map(function (ProductCategory $c) {
            // Prefer the curated thumbnail override; otherwise pick a stable
            // product image from anywhere in the category subtree. Querying
            // via the categories() M2M pivot (instead of the primary FK
            // alone) means a category that's only populated by cross-listed
            // products — e.g. Kids Chairs & Tables, where every kid product
            // primarily lives in another category — still gets a real
            // thumbnail rather than the SVG fallback. orderBy('products.id')
            // keeps the chosen image stable across page loads (the homepage
            // would otherwise reshuffle on every visit, defeating browser
            // and CDN caching of the category tiles).
            if ($c->thumbnail) {
                $thumbnail = $c->thumbnail;
            } else {
                $subtreeIds = $c->descendantIds();
                $thumbnail = \App\Models\Product::query()
                    ->whereHas('categories', fn ($q) => $q->whereIn('product_categories.id', $subtreeIds))
                    ->whereNotNull('image')
                    ->orderBy('products.id')
                    ->value('image');
            }

            return [
                'id' => $c->id,
                'name' => $c->name,
                'slug' => $c->slug,
                'thumbnail' => $thumbnail,
            ];
        })
        ->values();

    return Inertia::render('Home', [
        'categories' => $categories,
    ]);
})->name('home');

Route::get('/about', fn () => Inertia::render('About'))->name('about');
Route::get('/contact', fn () => Inertia::render('Contact'))->name('contact');
Route::get('/faq', fn () => Inertia::render('Faq'))->name('faq');
Route::get('/privacy', fn () => Inertia::render('Privacy'))->name('privacy');
Route::get('/return-policy', fn () => Inertia::render('ReturnPolicy'))->name('return-policy');
Route::get('/shipping', fn () => Inertia::render('Shipping'))->name('shipping');
Route::get('/terms', fn () => Inertia::render('Terms'))->name('terms');
Route::get('/warranty', fn () => Inertia::render('Warranty'))->name('warranty');

Route::get('/login', fn () => Inertia::render('Login'))->name('login');
Route::get('/register', fn () => Inertia::render('Register'))->name('register');
Route::get('/dashboard', fn () => Inertia::render('Dashboard'))->name('dashboard');

Route::get('/cart', fn () => Inertia::render('Cart'))->name('cart');
Route::get('/checkout', fn () => Inertia::render('Checkout'))->name('checkout');

Route::get('/plastic-folding-chairs', fn () => Inertia::render('PlasticFoldingChairs'))
    ->name('plastic-folding-chairs');

Route::get('/products', [ProductController::class, 'index'])->name('products');

Route::post('/newsletter/subscribe', [NewsletterController::class, 'subscribe'])
    ->name('newsletter.subscribe');

Route::post('/contact', [ContactController::class, 'submit'])
    ->name('contact.submit');

Route::post('/register', [RegistrationController::class, 'store'])
    ->name('register.submit');

Route::post('/orders', [OrderController::class, 'store'])
    ->name('orders.store');

Route::get('/customer/orders', [OrderController::class, 'index'])
    ->name('customer.orders');

// Catch-all dispatcher for both categories and products. Declared LAST so explicit
// routes above (/about, /login, /products, /plastic-folding-chairs, etc.) always
// win for matching paths.
//
// CategoryController::show resolves the trailing slug against the DB:
//   - matches an active ProductCategory → DB-backed category page
//   - single-segment URL matching an active Product → product detail page
//     (also keeps the legacy static-JSON fallback for unknown product slugs)
//   - otherwise → static-data Products listing
Route::get('/{path}', [CategoryController::class, 'show'])
    ->where('path', '.+')
    ->name('catalog.show');
