import { useEffect, useMemo, useRef, useState } from 'react';
import { Head, Link } from '@inertiajs/react';
import Header from '@/Components/Header';
import Footer from '@/Components/Footer';
import { useAuth } from '@/hooks/useAuth';
import fallbackProducts from '@/data/plastic-folding-chairs.json';

const DEFAULT_BREADCRUMBS = [
    { label: 'Home', href: '/' },
    { label: 'Chairs', href: '/products' },
    { label: 'Plastic Folding Chairs' },
];

const PAGE_SIZE = 24;

export default function PlasticFoldingChairsPage({ products, category, breadcrumbs }) {
    // Server-passed props (DB-backed route) take precedence; legacy /plastic-folding-chairs
    // route renders this page without props, so fall back to the bundled JSON snapshot.
    const items = products ?? fallbackProducts;
    const crumbs = breadcrumbs ?? DEFAULT_BREADCRUMBS;
    const heading = category?.name ?? 'Plastic Folding Chairs';
    const { isLoggedIn, hydrated } = useAuth();

    // ---- Filter state -----------------------------------------------------
    const [priceMin, setPriceMin] = useState('');
    const [priceMax, setPriceMax] = useState('');
    const [selectedColors, setSelectedColors] = useState(() => new Set());
    const [expanded, setExpanded] = useState({ price: true, color: true });

    // Numeric range across the unfiltered set, used to placeholder the inputs.
    const priceRange = useMemo(() => {
        if (items.length === 0) return { min: 0, max: 0 };
        const prices = items
            .map((p) => parseFloat(p.price))
            .filter((n) => !isNaN(n));
        if (prices.length === 0) return { min: 0, max: 0 };
        return { min: Math.min(...prices), max: Math.max(...prices) };
    }, [items]);

    // Aggregate distinct color variants across the product set; show frequency
    // alongside the swatch so the most common options surface first.
    const colorOptions = useMemo(() => {
        const map = new Map();
        items.forEach((p) => {
            (p.colors ?? []).forEach((c) => {
                if (!c?.label) return;
                const existing = map.get(c.label);
                if (existing) {
                    existing.count += 1;
                } else {
                    map.set(c.label, { label: c.label, swatch: c.swatch, count: 1 });
                }
            });
        });
        return Array.from(map.values()).sort((a, b) => b.count - a.count);
    }, [items]);

    const filtered = useMemo(() => {
        const minNum = priceMin === '' ? null : parseFloat(priceMin);
        const maxNum = priceMax === '' ? null : parseFloat(priceMax);
        const hasColorFilter = selectedColors.size > 0;

        return items.filter((p) => {
            const price = parseFloat(p.price);
            if (minNum !== null && !isNaN(minNum) && price < minNum) return false;
            if (maxNum !== null && !isNaN(maxNum) && price > maxNum) return false;
            if (hasColorFilter) {
                const labels = (p.colors ?? [])
                    .map((c) => c?.label)
                    .filter(Boolean);
                if (!labels.some((l) => selectedColors.has(l))) return false;
            }
            return true;
        });
    }, [items, priceMin, priceMax, selectedColors]);

    const toggleColor = (label) => {
        setSelectedColors((prev) => {
            const next = new Set(prev);
            if (next.has(label)) next.delete(label);
            else next.add(label);
            return next;
        });
    };

    const filtersActive =
        priceMin !== '' || priceMax !== '' || selectedColors.size > 0;

    const resetFilters = () => {
        setPriceMin('');
        setPriceMax('');
        setSelectedColors(new Set());
    };

    // ---- Pagination ------------------------------------------------------
    // Client-side: the controller already ships every product in the
    // category, and the price/color filters above run locally. Slicing
    // here means filters and pages compose — change a filter and you
    // jump back to page 1, change a page and you stay within the
    // currently filtered set.
    const [page, setPage] = useState(() => {
        if (typeof window === 'undefined') return 1;
        const fromUrl = parseInt(
            new URLSearchParams(window.location.search).get('page') || '1',
            10,
        );
        return fromUrl > 0 ? fromUrl : 1;
    });

    // Reset to page 1 whenever a filter changes — otherwise tightening
    // a filter could leave the user on a page that no longer exists.
    // The ref guard skips the very first effect run so a deep-link like
    // `?page=3` (read into useState above) survives the initial mount.
    const isFirstRender = useRef(true);
    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }
        setPage(1);
    }, [priceMin, priceMax, selectedColors]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const safePage = Math.min(Math.max(page, 1), totalPages);
    const visible = filtered.slice(
        (safePage - 1) * PAGE_SIZE,
        safePage * PAGE_SIZE,
    );

    // Mirror the page into ?page= so the URL is shareable and the back
    // button works, but skip the Inertia round-trip — pagination is purely
    // a client-side slice over data we already have.
    const goToPage = (n) => {
        if (n < 1 || n > totalPages || n === safePage) return;
        setPage(n);
        const params = new URLSearchParams(window.location.search);
        if (n === 1) params.delete('page');
        else params.set('page', String(n));
        const qs = params.toString();
        window.history.replaceState(
            {},
            '',
            window.location.pathname + (qs ? '?' + qs : ''),
        );
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <>
            <Head title={`${heading} | Lachairs Commercial Products`} />
            <div className="flex flex-col min-h-screen bg-white">
                <Header />

                <div className="max-w-[1440px] mx-auto px-6 lg:px-12 w-full pt-6 pb-2">
                    <nav className="flex items-center gap-1.5 text-xs text-gray-400 mb-4">
                        {crumbs.map((crumb, i) => (
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
                        {heading}
                    </h1>
                    <p className="text-sm text-body mb-4">
                        {filtersActive
                            ? `${filtered.length} of ${items.length} products`
                            : `${items.length} products`}
                    </p>
                </div>

                <main className="flex-1 max-w-[1440px] mx-auto px-6 lg:px-12 w-full pb-16">
                    <div className="flex gap-8">
                        <aside className="w-56 shrink-0 hidden md:block">
                            {filtersActive && (
                                <button
                                    type="button"
                                    onClick={resetFilters}
                                    className="text-xs font-medium text-brand hover:underline mb-3"
                                >
                                    Clear all filters
                                </button>
                            )}

                            {/* PRICE ------------------------------------------------ */}
                            <div className="border-t border-gray-200 py-3">
                                <button
                                    type="button"
                                    onClick={() =>
                                        setExpanded((s) => ({ ...s, price: !s.price }))
                                    }
                                    className="flex items-center justify-between w-full text-sm font-bold text-heading mb-3"
                                >
                                    PRICE
                                    <span className="text-xs font-normal">
                                        {expanded.price ? '−' : '+'}
                                    </span>
                                </button>
                                {expanded.price && (
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="number"
                                                inputMode="decimal"
                                                min="0"
                                                step="1"
                                                value={priceMin}
                                                onChange={(e) => setPriceMin(e.target.value)}
                                                placeholder={`$${Math.floor(priceRange.min)}`}
                                                className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 outline-none focus:border-brand"
                                                aria-label="Minimum price"
                                            />
                                            <span className="text-xs text-gray-400">to</span>
                                            <input
                                                type="number"
                                                inputMode="decimal"
                                                min="0"
                                                step="1"
                                                value={priceMax}
                                                onChange={(e) => setPriceMax(e.target.value)}
                                                placeholder={`$${Math.ceil(priceRange.max)}`}
                                                className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 outline-none focus:border-brand"
                                                aria-label="Maximum price"
                                            />
                                        </div>
                                        {(priceMin !== '' || priceMax !== '') && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setPriceMin('');
                                                    setPriceMax('');
                                                }}
                                                className="text-xs text-gray-500 hover:text-brand"
                                            >
                                                Clear price
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* COLOR ------------------------------------------------ */}
                            <div className="border-t border-gray-200 py-3">
                                <button
                                    type="button"
                                    onClick={() =>
                                        setExpanded((s) => ({ ...s, color: !s.color }))
                                    }
                                    className="flex items-center justify-between w-full text-sm font-bold text-heading mb-3"
                                >
                                    COLOR
                                    <span className="text-xs font-normal">
                                        {expanded.color ? '−' : '+'}
                                    </span>
                                </button>
                                {expanded.color && (
                                    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                                        {colorOptions.length === 0 && (
                                            <p className="text-xs text-gray-400 italic">
                                                No color variants
                                            </p>
                                        )}
                                        {colorOptions.map((c) => {
                                            const checked = selectedColors.has(c.label);
                                            const isImage =
                                                typeof c.swatch === 'string' &&
                                                (c.swatch.startsWith('/') ||
                                                    c.swatch.startsWith('http'));
                                            const isHex =
                                                typeof c.swatch === 'string' &&
                                                c.swatch.startsWith('#');
                                            return (
                                                <label
                                                    key={c.label}
                                                    className="flex items-center gap-2 text-sm text-body cursor-pointer hover:text-heading"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={checked}
                                                        onChange={() => toggleColor(c.label)}
                                                        className="w-4 h-4 rounded border-gray-300 text-brand focus:ring-brand accent-brand"
                                                    />
                                                    <span
                                                        className="w-4 h-4 rounded-full border border-gray-300 overflow-hidden flex-shrink-0"
                                                        style={isHex ? { backgroundColor: c.swatch } : undefined}
                                                        aria-hidden="true"
                                                    >
                                                        {isImage && (
                                                            <img
                                                                src={c.swatch}
                                                                alt=""
                                                                className="w-full h-full object-cover"
                                                                loading="lazy"
                                                            />
                                                        )}
                                                    </span>
                                                    <span className="truncate">
                                                        {c.label}
                                                        <span className="text-gray-400 ml-1">
                                                            ({c.count})
                                                        </span>
                                                    </span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </aside>

                        <div className="flex-1 min-w-0">
                            {filtered.length === 0 ? (
                                <p className="text-sm text-body py-12 text-center">
                                    {items.length === 0
                                        ? 'No products in this category yet.'
                                        : 'No products match the selected filters.'}
                                </p>
                            ) : (
                                <>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                                        {visible.map((p) => (
                                            <ProductCard
                                                key={p.id}
                                                p={p}
                                                isLoggedIn={isLoggedIn}
                                                hydrated={hydrated}
                                            />
                                        ))}
                                    </div>

                                    <Paginator
                                        currentPage={safePage}
                                        totalPages={totalPages}
                                        onChange={goToPage}
                                    />

                                    <div className="flex items-center justify-between border-t border-gray-200 pt-4 mt-6 text-sm text-body">
                                        <span>
                                            Showing{' '}
                                            {(safePage - 1) * PAGE_SIZE + 1}
                                            –
                                            {Math.min(
                                                safePage * PAGE_SIZE,
                                                filtered.length,
                                            )}{' '}
                                            of {filtered.length}
                                            {filtered.length !== items.length && (
                                                <>
                                                    {' '}
                                                    <span className="text-gray-400">
                                                        (filtered from {items.length})
                                                    </span>
                                                </>
                                            )}
                                        </span>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </main>

                <Footer />
            </div>
        </>
    );
}

/**
 * Numeric paginator with first/last anchors and ellipsis collapse for runs in
 * the middle. Mirrors the look-and-feel of the Products.jsx paginator so the
 * two listing surfaces feel like the same control. Hidden when there's only
 * a single page.
 */
function Paginator({ currentPage, totalPages, onChange }) {
    if (totalPages <= 1) return null;

    const pages = [];
    if (totalPages <= 7) {
        for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else if (currentPage <= 4) {
        for (let i = 1; i <= 5; i++) pages.push(i);
        pages.push('...', totalPages);
    } else if (currentPage >= totalPages - 3) {
        pages.push(1, '...');
        for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
    } else {
        pages.push(1, '...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
        pages.push('...', totalPages);
    }

    return (
        <div className="flex items-center justify-center gap-2 mt-8">
            <button
                onClick={() => onChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-3 py-2 text-sm border border-gray-300 rounded hover:border-brand transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
                Previous
            </button>
            {pages.map((p, idx) =>
                typeof p === 'string' ? (
                    <span key={`gap-${idx}`} className="px-2 text-body">
                        ...
                    </span>
                ) : (
                    <button
                        key={p}
                        onClick={() => onChange(p)}
                        className={`px-3 py-2 text-sm border rounded transition-colors ${
                            p === currentPage
                                ? 'bg-brand text-white border-brand'
                                : 'border-gray-300 hover:border-brand'
                        }`}
                    >
                        {p}
                    </button>
                ),
            )}
            <button
                onClick={() => onChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-3 py-2 text-sm border border-gray-300 rounded hover:border-brand transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
                Next
            </button>
        </div>
    );
}

/**
 * Card with optional color-swatch row. When a swatch is clicked, the card
 * image swaps to that variant's first gallery image. Click is preventDefault'd
 * so the surrounding product link doesn't fire. Products with no `colors`
 * array (or an empty one) render as before — no swatch row, no extra space.
 */
function ProductCard({ p, isLoggedIn, hydrated }) {
    const colors = p.colors ?? [];
    const [colorIdx, setColorIdx] = useState(null);

    const displayImage = colorIdx !== null && colors[colorIdx]
        ? colors[colorIdx].image
        : p.image;

    const href = p.slug ? `/${p.slug}` : null;
    const Card = href ? Link : 'div';
    const cardProps = href ? { href } : {};

    return (
        <article className="flex flex-col bg-white rounded-lg border border-gray-200 hover:border-brand/40 hover:shadow-md transition-all overflow-hidden group">
            <Card {...cardProps} className="block aspect-square bg-gray-50 overflow-hidden">
                <img
                    src={displayImage}
                    alt={p.name}
                    className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                />
            </Card>
            <div className="flex flex-col flex-1 p-4 gap-2">
                <Card
                    {...cardProps}
                    className="text-sm font-medium text-heading leading-snug line-clamp-2 hover:text-brand transition-colors min-h-[2.5rem]"
                >
                    {p.name}
                </Card>
                {colors.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                        {colors.map((c, i) => {
                            const isImageSwatch = typeof c.swatch === 'string'
                                && (c.swatch.startsWith('/') || c.swatch.startsWith('http'));
                            const isHexSwatch = typeof c.swatch === 'string'
                                && c.swatch.startsWith('#');
                            const isSelected = colorIdx === i;
                            return (
                                <button
                                    key={i}
                                    type="button"
                                    onClick={(e) => {
                                        // Card root is a Link; stop the click from navigating.
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setColorIdx(i);
                                    }}
                                    aria-label={c.label || `Color ${i + 1}`}
                                    aria-pressed={isSelected}
                                    title={c.label || undefined}
                                    className={`w-5 h-5 rounded-full overflow-hidden flex-shrink-0 border transition-shadow ${
                                        isSelected
                                            ? 'ring-2 ring-brand ring-offset-1 border-transparent'
                                            : 'border-gray-300 hover:border-gray-400'
                                    }`}
                                    style={isHexSwatch ? { backgroundColor: c.swatch } : undefined}
                                >
                                    {isImageSwatch && (
                                        <img
                                            src={c.swatch}
                                            alt=""
                                            className="w-full h-full object-cover"
                                            loading="lazy"
                                        />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                )}
                <p className="text-sm text-brand font-semibold mt-auto">
                    {hydrated && !isLoggedIn ? (
                        <Link
                            href="/login"
                            className="text-xs font-medium text-brand hover:underline"
                        >
                            Login to view price
                        </Link>
                    ) : (
                        p.priceFormatted ?? p.price
                    )}
                </p>
            </div>
        </article>
    );
}
