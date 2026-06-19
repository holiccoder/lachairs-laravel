import { useState, useMemo } from 'react';
import { Head, Link, router, usePage } from '@inertiajs/react';
import Header from '@/Components/Header';
import Footer from '@/Components/Footer';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/hooks/useAuth';
import {
    getAllProducts,
    searchProducts,
    getCategoryByUrlKey,
    getProductsByCategory,
    getCategoryLookup,
} from '@/lib/magento';

function ColorSwatch({ color, border, label }) {
    return (
        <button
            title={label}
            className={`w-6 h-6 rounded-full shrink-0 ${border ? 'border border-gray-300' : ''}`}
            style={{ backgroundColor: color }}
        />
    );
}

const colorSwatches = [
    { color: '#FFFFFF', label: 'White', border: true },
    { color: '#1A1A1A', label: 'Black' },
    { color: '#808080', label: 'Gray' },
    { color: '#8B4513', label: 'Brown' },
    { color: '#EC4899', label: 'Pink' },
    { color: '#EF4444', label: 'Red' },
    { color: '#F97316', label: 'Orange' },
    { color: '#EAB308', label: 'Yellow' },
    { color: '#10B981', label: 'Green' },
    { color: '#3B82F6', label: 'Blue' },
];

function slugToLabel(slug) {
    return slug
        .split('-')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
}

export default function ProductsPage({
    products: serverProducts,
    total: serverTotal,
    q: serverQ,
    pagination: serverPagination,
    categoryNames: serverCategoryNames,
}) {
    const { url } = usePage();
    const { search } = window.location;
    const params = useMemo(() => new URLSearchParams(search || ''), [search]);

    // Inertia URL is /products (all), /{search-q}, or /{category}/{subcategory}/...
    // Treat the bare /products path as "all products" with no category segments;
    // anything else under root is a category path captured by routes/web.php's
    // `/{path}` catch-all.
    const pathname = url.split('?')[0];
    const segments = pathname === '/products'
        ? []
        : pathname.replace(/^\//, '').split('/').filter(Boolean);
    const q = serverQ ?? params.get('q') ?? undefined;
    const pageParam = parseInt(params.get('page') || '1', 10);
    const pageSize = 24;

    // Prefer the DB-backed category map the controller ships with `serverProducts`;
    // fall back to the static Magento snapshot for legacy category-path renders.
    const staticCategoryNames = useMemo(() => getCategoryLookup(), []);
    const categoryNames = serverCategoryNames ?? staticCategoryNames;

    let title;
    let breadcrumbs;
    let products;
    let total;
    let pagination = null;

    // Server-supplied DB search results take precedence over the static lib.
    // This is the path the Header search box hits via /products?q=...
    if (Array.isArray(serverProducts)) {
        products = serverProducts;
        total = serverTotal ?? serverProducts.length;
        pagination = serverPagination ?? null;
    } else if (segments.length > 0) {
        const urlKey = segments[segments.length - 1];
        const urlPath = segments.join('/');
        const category = getCategoryByUrlKey(urlKey) || getCategoryByUrlKey(urlPath);

        if (!category) {
            return (
                <>
                    <Head title="Category not found" />
                    <div className="flex flex-col min-h-screen bg-white">
                        <Header />
                        <div className="max-w-[1440px] mx-auto px-6 lg:px-12 py-20 text-center flex-1">
                            <h1 className="text-2xl font-bold text-heading mb-3">Category not found</h1>
                            <Link href="/products" className="text-brand">
                                Browse all products
                            </Link>
                        </div>
                        <Footer />
                    </div>
                </>
            );
        }

        const result = getProductsByCategory(category.id, pageParam, pageSize);
        products = result.items;
        total = result.total;
        pagination = {
            currentPage: pageParam,
            totalPages: Math.ceil(total / pageSize),
            totalItems: total,
            pageSize,
        };
        title = category.name;

        const pathSegments = category.urlPath ? category.urlPath.split('/') : [category.urlKey];
        breadcrumbs = [{ label: 'Home', href: '/' }];
        for (let i = 0; i < pathSegments.length; i++) {
            const isLast = i === pathSegments.length - 1;
            const slugPath = '/' + pathSegments.slice(0, i + 1).join('/');
            breadcrumbs.push({
                label: slugToLabel(pathSegments[i]),
                href: isLast ? undefined : slugPath,
            });
        }
    } else if (q) {
        const result = searchProducts(q);
        products = result.items;
        total = result.total;
    } else {
        products = getAllProducts();
        total = products.length;
    }

    const defaultBreadcrumbs = [
        { label: 'Home', href: '/' },
        { label: 'All Products' },
    ];

    return (
        <>
            <Head title={title || 'All Products'} />
            <div className="flex flex-col min-h-screen bg-white">
                <Header />
                <ProductsClient
                    products={products}
                    title={title}
                    breadcrumbs={breadcrumbs || defaultBreadcrumbs}
                    categoryNames={categoryNames}
                    searchQuery={q}
                    pagination={pagination}
                />
                <Footer />
            </div>
        </>
    );
}

function ProductsClient({ products, title, breadcrumbs, categoryNames, searchQuery, pagination }) {
    const { url } = usePage();
    const pathname = url.split('?')[0];

    const [sortBy, setSortBy] = useState('Position');
    const [showCount, setShowCount] = useState('24');
    const [expandedFilters, setExpandedFilters] = useState({
        category: true,
        color: true,
        onSale: true,
        paddedSeat: true,
    });
    const [checkedFilters, setCheckedFilters] = useState({});

    const { addItem } = useCart();
    const { isLoggedIn } = useAuth();

    const toggleFilter = (key) => {
        setExpandedFilters((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    const toggleCheckbox = (key) => {
        setCheckedFilters((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    const handlePageChange = (page) => {
        const params = new URLSearchParams(window.location.search);
        if (page === 1) {
            params.delete('page');
        } else {
            params.set('page', page.toString());
        }
        const qs = params.toString();
        router.visit(`${pathname}${qs ? '?' + qs : ''}`);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const renderPagination = () => {
        if (!pagination || pagination.totalPages <= 1) return null;

        const { currentPage, totalPages } = pagination;
        const pages = [];

        if (totalPages <= 7) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
            if (currentPage <= 4) {
                for (let i = 1; i <= 5; i++) pages.push(i);
                pages.push('...');
                pages.push(totalPages);
            } else if (currentPage >= totalPages - 3) {
                pages.push(1);
                pages.push('...');
                for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
            } else {
                pages.push(1);
                pages.push('...');
                for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
                pages.push('...');
                pages.push(totalPages);
            }
        }

        return (
            <div className="flex items-center justify-center gap-2 mt-8 mb-8">
                <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="px-3 py-2 text-sm border border-gray-300 rounded hover:border-brand transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Previous
                </button>

                {pages.map((page, idx) =>
                    typeof page === 'string' ? (
                        <span key={`ellipsis-${idx}`} className="px-2 text-body">
                            ...
                        </span>
                    ) : (
                        <button
                            key={page}
                            onClick={() => handlePageChange(page)}
                            className={`px-3 py-2 text-sm border rounded transition-colors ${
                                page === currentPage
                                    ? 'bg-brand text-white border-brand'
                                    : 'border-gray-300 hover:border-brand'
                            }`}
                        >
                            {page}
                        </button>
                    ),
                )}

                <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="px-3 py-2 text-sm border border-gray-300 rounded hover:border-brand transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Next
                </button>
            </div>
        );
    };

    const categoryMap = new Map();
    products.forEach((p) => {
        p.categoryIds.forEach((id) => {
            categoryMap.set(id, (categoryMap.get(id) || 0) + 1);
        });
    });

    const categoryFilters = Array.from(categoryMap.entries()).map(([id, count]) => {
        const info = categoryNames?.[id];
        return {
            id,
            label: info?.name || `Category ${id}`,
            href: info?.urlPath ? `/${info.urlPath}` : null,
            count,
        };
    });

    let sorted = [...products];
    if (sortBy === 'Name (A-Z)') sorted.sort((a, b) => a.name.localeCompare(b.name));
    else if (sortBy === 'Name (Z-A)') sorted.sort((a, b) => b.name.localeCompare(a.name));
    else if (sortBy === 'Price (Low-High)') sorted.sort((a, b) => a.price - b.price);
    else if (sortBy === 'Price (High-Low)') sorted.sort((a, b) => b.price - a.price);

    const displayed = sorted;

    return (
        <>
            <div className="max-w-[1440px] mx-auto px-6 lg:px-12 w-full pt-6 pb-2">
                <nav className="flex items-center gap-1.5 text-xs text-gray-400 mb-4">
                    {breadcrumbs.map((crumb, i) => (
                        <span key={crumb.label} className="flex items-center gap-1.5">
                            {i > 0 && <span>&gt;</span>}
                            {crumb.href ? (
                                <Link href={crumb.href} className="hover:text-brand transition-colors">
                                    {crumb.label}
                                </Link>
                            ) : (
                                <span className="text-gray-500">{crumb.label}</span>
                            )}
                        </span>
                    ))}
                </nav>

                <h1 className="text-2xl md:text-3xl font-bold text-heading mb-2">
                    {searchQuery
                        ? `Search results for "${searchQuery}"`
                        : title || 'All Products'}
                </h1>
                {searchQuery && (
                    <p className="text-sm text-body mb-4">
                        {products.length} {products.length === 1 ? 'product' : 'products'} found
                    </p>
                )}
            </div>

            <div className="max-w-[1440px] mx-auto px-6 lg:px-12 w-full">
                <div className="flex gap-8">
                    <aside className="w-56 shrink-0 hidden md:block">
                        <div className="border-t border-gray-200 py-3">
                            <button
                                onClick={() => toggleFilter('category')}
                                className="flex items-center justify-between w-full text-sm font-bold text-heading mb-3"
                            >
                                CATEGORY
                                <span className="text-xs font-normal">
                                    {expandedFilters.category ? '−' : '+'}
                                </span>
                            </button>
                            {expandedFilters.category && (
                                <div className="space-y-2">
                                    {categoryFilters.map((f) => (
                                        <label
                                            key={f.id}
                                            className="flex items-center gap-2 text-sm text-body cursor-pointer"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={!!checkedFilters[f.id]}
                                                onChange={() => toggleCheckbox(f.id)}
                                                className="w-4 h-4 rounded border-gray-300 text-brand focus:ring-brand accent-brand"
                                            />
                                            {f.href ? (
                                                <Link href={f.href} className="hover:text-brand transition-colors">
                                                    {f.label} ({f.count})
                                                </Link>
                                            ) : (
                                                <span>
                                                    {f.label} ({f.count})
                                                </span>
                                            )}
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="border-t border-gray-200 py-3">
                            <button
                                onClick={() => toggleFilter('color')}
                                className="flex items-center justify-between w-full text-sm font-bold text-heading mb-3"
                            >
                                COLOR
                                <span className="text-xs font-normal">
                                    {expandedFilters.color ? '−' : '+'}
                                </span>
                            </button>
                            {expandedFilters.color && (
                                <div className="flex flex-wrap gap-2">
                                    {colorSwatches.map((swatch) => (
                                        <ColorSwatch key={swatch.label} {...swatch} />
                                    ))}
                                </div>
                            )}
                        </div>
                    </aside>

                    <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-sm text-body">
                                {pagination
                                    ? `${pagination.totalItems} Items`
                                    : `${products.length} Items`}
                            </span>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-body">Sort By</span>
                                <select
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value)}
                                    className="text-sm border border-gray-200 rounded px-2 py-1.5 outline-none focus:border-brand text-heading"
                                >
                                    <option>Position</option>
                                    <option>Name (A-Z)</option>
                                    <option>Name (Z-A)</option>
                                    <option>Price (Low-High)</option>
                                    <option>Price (High-Low)</option>
                                </select>
                            </div>
                        </div>

                        {!isLoggedIn && (
                            <Link
                                href="/login"
                                className="block bg-brand hover:bg-brand-dark text-white text-center py-2.5 rounded text-sm font-medium mb-4 transition-colors"
                            >
                                Login or Register to View Prices
                            </Link>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                            {displayed.map((product) => (
                                <div
                                    key={product.id}
                                    className="bg-white border border-gray-100 rounded-lg overflow-hidden group hover:shadow-md transition-shadow flex flex-col"
                                >
                                    <Link
                                        href={`/${encodeURIComponent(product.urlKey || product.sku)}`}
                                        className="block"
                                    >
                                        <div className="aspect-square bg-gray-50 relative overflow-hidden">
                                            {product.thumbnail ? (
                                                <img
                                                    src={product.thumbnail}
                                                    alt={product.name}
                                                    className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-gray-300">
                                                    <svg viewBox="0 0 48 48" className="w-12 h-12" fill="none" stroke="currentColor" strokeWidth="1">
                                                        <rect x="6" y="10" width="36" height="28" rx="2" />
                                                        <circle cx="17" cy="20" r="3" />
                                                        <path d="M6 30 L18 22 L26 28 L36 18 L42 22 L42 38 L6 38Z" strokeLinejoin="round" />
                                                    </svg>
                                                </div>
                                            )}
                                        </div>
                                    </Link>

                                    <div className="p-4 flex flex-col flex-1">
                                        <Link
                                            href={`/${encodeURIComponent(product.urlKey || product.sku)}`}
                                            className="block flex-1"
                                        >
                                            <h3 className="text-base font-medium text-heading leading-snug mb-1 line-clamp-2 group-hover:text-brand transition-colors">
                                                {product.name}
                                            </h3>
                                            <p className="text-xs text-gray-400">{product.sku}</p>
                                        </Link>

                                        {isLoggedIn && (
                                            <div className="mt-3">
                                                {product.typeId === 'configurable' ? (
                                                    <Link
                                                        href={`/${encodeURIComponent(product.urlKey || product.sku)}`}
                                                        className="block w-full text-center text-xs text-brand border border-brand/30 rounded py-1.5 hover:bg-brand hover:text-white transition-colors"
                                                    >
                                                        Select Options
                                                    </Link>
                                                ) : (
                                                    <button
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            addItem({
                                                                productId: product.id,
                                                                sku: product.sku,
                                                                name: product.name,
                                                                price: isLoggedIn ? product.price : 0,
                                                                quantity: 1,
                                                                image: product.thumbnail,
                                                                selectedOptions: {},
                                                                optionLabels: {},
                                                                urlKey: product.urlKey || product.sku,
                                                                typeId: product.typeId,
                                                            });
                                                        }}
                                                        className={`w-full text-center text-xs rounded py-1.5 transition-colors ${
                                                            product.status !== 1
                                                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                                                                : 'text-brand border border-brand/30 hover:bg-brand hover:text-white'
                                                        }`}
                                                        disabled={product.status !== 1}
                                                    >
                                                        {product.status !== 1 ? 'Out of Stock' : 'Add to Cart'}
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {renderPagination()}

                        <div className="flex items-center justify-between border-t border-gray-200 pt-4 mb-8">
                            <span className="text-sm text-body">
                                {pagination
                                    ? `Showing ${(pagination.currentPage - 1) * pagination.pageSize + 1}-${Math.min(
                                          pagination.currentPage * pagination.pageSize,
                                          pagination.totalItems,
                                      )} of ${pagination.totalItems} items`
                                    : `${products.length} Items`}
                            </span>
                            {!pagination && (
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-body">Show</span>
                                    <select
                                        value={showCount}
                                        onChange={(e) => setShowCount(e.target.value)}
                                        className="text-sm border border-gray-200 rounded px-2 py-1.5 outline-none focus:border-brand text-heading"
                                    >
                                        <option>12</option>
                                        <option>24</option>
                                        <option>48</option>
                                    </select>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
