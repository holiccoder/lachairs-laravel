import { useState, useCallback, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link, router, usePage } from '@inertiajs/react';
import { useAuth } from '@/hooks/useAuth';
import CartIconButton from '@/Components/cart/CartIconButton';
import CartDrawer from '@/Components/cart/CartDrawer';
import Toast from '@/Components/cart/Toast';

const buildHref = (...slugs) => `/${slugs.filter(Boolean).join('/')}`;

export default function Header() {
    const { url } = usePage();
    const auth = useAuth();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [accountMenuOpen, setAccountMenuOpen] = useState(false);
    const [megaMenuOpen, setMegaMenuOpen] = useState(false);
    const [activeRoot, setActiveRoot] = useState(null);
    const [activeChild, setActiveChild] = useState(null);
    const [mobileCategoryOpen, setMobileCategoryOpen] = useState(false);
    const [mobileExpandedRoot, setMobileExpandedRoot] = useState(null);
    const [mobileExpandedChild, setMobileExpandedChild] = useState(null);
    const [searchValue, setSearchValue] = useState('');
    const [navCategories, setNavCategories] = useState([]);
    const megaCloseTimer = useRef(null);
    const accountCloseTimer = useRef(null);
    const accountMenuRef = useRef(null);

    useEffect(() => {
        let cancelled = false;
        fetch('/js/menu.json', { headers: { Accept: 'application/json' } })
            .then((res) => (res.ok ? res.json() : []))
            .then((data) => {
                if (!cancelled && Array.isArray(data)) {
                    setNavCategories(data);
                }
            })
            .catch(() => {
                if (!cancelled) setNavCategories([]);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        setMobileMenuOpen(false);
        setMobileCategoryOpen(false);
        setMobileExpandedRoot(null);
        setMobileExpandedChild(null);
        setMegaMenuOpen(false);
        setAccountMenuOpen(false);
    }, [url]);

    useEffect(() => {
        const onDocumentClick = (event) => {
            if (!accountMenuRef.current) return;
            if (!accountMenuRef.current.contains(event.target)) {
                setAccountMenuOpen(false);
            }
        };

        document.addEventListener('mousedown', onDocumentClick);
        return () => {
            document.removeEventListener('mousedown', onDocumentClick);
            if (accountCloseTimer.current) {
                clearTimeout(accountCloseTimer.current);
            }
        };
    }, []);

    const handleSearch = (e) => {
        e.preventDefault();
        if (searchValue.trim()) {
            router.visit(`/products?q=${encodeURIComponent(searchValue.trim())}`);
            setMobileMenuOpen(false);
        }
    };

    const openMegaMenu = useCallback(() => {
        if (megaCloseTimer.current) {
            clearTimeout(megaCloseTimer.current);
            megaCloseTimer.current = null;
        }
        setMegaMenuOpen(true);
    }, []);

    const closeMegaMenu = useCallback(() => {
        megaCloseTimer.current = setTimeout(() => {
            setMegaMenuOpen(false);
            setActiveRoot(null);
            setActiveChild(null);
        }, 200);
    }, []);

    const openAccountMenu = useCallback(() => {
        if (accountCloseTimer.current) {
            clearTimeout(accountCloseTimer.current);
            accountCloseTimer.current = null;
        }
        setAccountMenuOpen(true);
    }, []);

    const closeAccountMenu = useCallback(() => {
        accountCloseTimer.current = setTimeout(() => setAccountMenuOpen(false), 160);
    }, []);

    const rootCategory = activeRoot != null ? navCategories[activeRoot] : null;
    const rootChildren = rootCategory?.children ?? [];
    const childCategory = activeChild != null ? rootChildren[activeChild] : null;
    const grandChildren = childCategory?.children ?? [];

    return (
        <header className="sticky top-0 z-50 bg-white border-b border-gray-100">
            <div className="max-w-[1440px] mx-auto px-6 lg:px-12 h-16 flex items-center justify-between gap-4">
                <Link href="/" className="flex items-center shrink-0">
                    <img src="/logo.jpg" alt="Lachairs" className="h-16 w-auto object-contain" />
                </Link>

                <nav className="hidden lg:flex items-center gap-6">
                    <div
                        className="relative"
                        onMouseEnter={openMegaMenu}
                        onMouseLeave={closeMegaMenu}
                    >
                        <button
                            className={`flex items-center gap-1 text-sm font-medium transition-colors ${
                                megaMenuOpen ? 'text-brand' : 'text-heading hover:text-brand'
                            }`}
                        >
                            Categories
                            <svg className="w-3 h-3 mt-px" viewBox="0 0 12 12" fill="currentColor">
                                <path d="M3 5 L6 8 L9 5" />
                            </svg>
                        </button>

                        {megaMenuOpen && navCategories.length > 0 && (
                            <div className="absolute left-0 top-full pt-2 z-50 flex items-start">
                                {/* Tier 1 — root categories */}
                                <ul className="w-56 bg-white border border-gray-100 shadow-lg py-1">
                                    {navCategories.map((cat, i) => {
                                        const hasKids = (cat.children?.length ?? 0) > 0;
                                        const isActive = i === activeRoot;
                                        return (
                                            <li key={cat.slug}>
                                                <Link
                                                    href={buildHref(cat.slug)}
                                                    onMouseEnter={() => {
                                                        setActiveRoot(i);
                                                        setActiveChild(null);
                                                    }}
                                                    className={`flex items-center justify-between px-4 py-2 text-sm transition-colors ${
                                                        isActive
                                                            ? 'bg-gray-100 text-heading'
                                                            : 'text-heading hover:bg-gray-50'
                                                    }`}
                                                >
                                                    <span>{cat.label}</span>
                                                    {hasKids && (
                                                        <svg
                                                            className="w-3 h-3 shrink-0 text-gray-400"
                                                            viewBox="0 0 12 12"
                                                            fill="currentColor"
                                                        >
                                                            <path d="M4.5 3 L7.5 6 L4.5 9" />
                                                        </svg>
                                                    )}
                                                </Link>
                                            </li>
                                        );
                                    })}
                                </ul>

                                {/* Tier 2 — children of hovered root */}
                                {rootCategory && rootChildren.length > 0 && (
                                    <ul className="w-56 bg-white border border-gray-100 shadow-lg py-1">
                                        {rootChildren.map((child, i) => {
                                            const hasGrand = (child.children?.length ?? 0) > 0;
                                            const isActive = i === activeChild;
                                            return (
                                                <li key={child.slug}>
                                                    <Link
                                                        href={buildHref(rootCategory.slug, child.slug)}
                                                        onMouseEnter={() => setActiveChild(i)}
                                                        className={`flex items-center justify-between px-4 py-2 text-sm transition-colors ${
                                                            isActive
                                                                ? 'bg-gray-100 text-heading'
                                                                : 'text-body hover:bg-gray-50 hover:text-heading'
                                                        }`}
                                                    >
                                                        <span>{child.label}</span>
                                                        {hasGrand && (
                                                            <svg
                                                                className="w-3 h-3 shrink-0 text-gray-400"
                                                                viewBox="0 0 12 12"
                                                                fill="currentColor"
                                                            >
                                                                <path d="M4.5 3 L7.5 6 L4.5 9" />
                                                            </svg>
                                                        )}
                                                    </Link>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}

                                {/* Tier 3 — grandchildren of hovered child */}
                                {childCategory && grandChildren.length > 0 && (
                                    <ul className="w-56 bg-white border border-gray-100 shadow-lg py-1">
                                        {grandChildren.map((grand) => (
                                            <li key={grand.slug}>
                                                <Link
                                                    href={buildHref(
                                                        rootCategory.slug,
                                                        childCategory.slug,
                                                        grand.slug,
                                                    )}
                                                    className="block px-4 py-2 text-sm text-body hover:bg-gray-50 hover:text-heading transition-colors"
                                                >
                                                    {grand.label}
                                                </Link>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        )}
                    </div>
                </nav>

                <Link
                    href="/register"
                    className="hidden lg:block bg-brand hover:bg-brand-dark text-white text-xs font-semibold px-4 py-2.5 rounded transition-colors whitespace-nowrap"
                >
                    CREATE WHOLESALE ACCOUNT
                </Link>

                <form
                    onSubmit={handleSearch}
                    className="hidden lg:flex items-center border border-gray-200 rounded px-3 py-1 gap-2 flex-1 max-w-[260px]"
                >
                    <button type="submit" className="shrink-0" aria-label="Search">
                        <svg
                            className="w-4 h-4 text-gray-400"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                        >
                            <circle cx="10" cy="10" r="7" />
                            <line x1="15" y1="15" x2="21" y2="21" strokeLinecap="round" />
                        </svg>
                    </button>
                    <input
                        type="text"
                        value={searchValue}
                        onChange={(e) => setSearchValue(e.target.value)}
                        placeholder="Search..."
                        className="text-sm text-body placeholder-gray-400 bg-transparent w-full appearance-none border-0 outline-none focus:outline-none focus:ring-0 focus:border-0 p-[0.2rem]"
                    />
                </form>

                <div className="hidden lg:flex items-center gap-4 shrink-0">
                    {auth.isLoggedIn ? (
                        <div
                            ref={accountMenuRef}
                            className="relative"
                            onMouseEnter={openAccountMenu}
                            onMouseLeave={closeAccountMenu}
                        >
                            <button
                                type="button"
                                onClick={() => setAccountMenuOpen((prev) => !prev)}
                                className="flex items-center gap-1 text-sm text-body hover:text-heading transition-colors"
                                aria-haspopup="menu"
                                aria-expanded={accountMenuOpen}
                            >
                                <span>Hello, {auth.firstName || 'Account'}</span>
                                <svg className="w-3 h-3 mt-px" viewBox="0 0 12 12" fill="currentColor">
                                    <path d="M3 5 L6 8 L9 5" />
                                </svg>
                            </button>

                            {accountMenuOpen ? (
                                <div
                                    className="absolute right-0 top-full pt-2 z-50"
                                    onMouseEnter={openAccountMenu}
                                >
                                    <div className="w-44 rounded-md border border-gray-200 bg-white shadow-lg py-1">
                                        <Link
                                            href="/dashboard"
                                            className="block px-4 py-2 text-sm text-heading hover:bg-gray-50"
                                            onClick={() => setAccountMenuOpen(false)}
                                        >
                                            My Account
                                        </Link>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                auth.logout();
                                                setAccountMenuOpen(false);
                                                router.visit('/');
                                            }}
                                            className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                                        >
                                            Logout
                                        </button>
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    ) : (
                        <Link
                            href="/login"
                            className="flex items-center gap-1 text-sm text-body hover:text-heading transition-colors"
                        >
                            <span>Hello Guest / Sign In</span>
                            <svg className="w-3 h-3 mt-px" viewBox="0 0 12 12" fill="currentColor">
                                <path d="M3 5 L6 8 L9 5" />
                            </svg>
                        </Link>
                    )}
                    <CartIconButton />
                </div>

                <div className="lg:hidden flex items-center gap-3">
                    <CartIconButton />
                    <button
                        className="text-heading"
                        onClick={() => {
                            const next = !mobileMenuOpen;
                            setMobileMenuOpen(next);
                            if (!next) setMobileCategoryOpen(false);
                        }}
                        aria-label="Toggle menu"
                    >
                        <svg
                            className="w-6 h-6"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                        >
                            {mobileMenuOpen ? (
                                <path d="M6 6 L18 18 M18 6 L6 18" strokeLinecap="round" />
                            ) : (
                                <>
                                    <line x1="4" y1="6" x2="20" y2="6" strokeLinecap="round" />
                                    <line x1="4" y1="12" x2="20" y2="12" strokeLinecap="round" />
                                    <line x1="4" y1="18" x2="20" y2="18" strokeLinecap="round" />
                                </>
                            )}
                        </svg>
                    </button>
                </div>
            </div>

            {mobileMenuOpen && (
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="lg:hidden bg-white border-t border-gray-100 px-6 py-4 flex flex-col gap-4"
                >
                    <div>
                        <button
                            onClick={() => setMobileCategoryOpen(!mobileCategoryOpen)}
                            className="flex items-center gap-1 text-sm font-medium text-heading w-full"
                        >
                            Categories
                            <svg
                                className={`w-3 h-3 mt-px transition-transform ${
                                    mobileCategoryOpen ? 'rotate-180' : ''
                                }`}
                                viewBox="0 0 12 12"
                                fill="currentColor"
                            >
                                <path d="M3 5 L6 8 L9 5" />
                            </svg>
                        </button>
                        {mobileCategoryOpen && navCategories.length > 0 && (
                            <div className="mt-3 ml-2 pl-3 border-l-2 border-gray-200 space-y-1">
                                {navCategories.map((cat, i) => {
                                    const hasKids = (cat.children?.length ?? 0) > 0;
                                    const expanded = mobileExpandedRoot === i;
                                    return (
                                        <div key={cat.slug}>
                                            <div className="flex items-center justify-between gap-2">
                                                <Link
                                                    href={buildHref(cat.slug)}
                                                    onClick={() => setMobileMenuOpen(false)}
                                                    className="text-sm font-medium text-heading hover:text-brand transition-colors block py-1 flex-1"
                                                >
                                                    {cat.label}
                                                </Link>
                                                {hasKids && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setMobileExpandedRoot(expanded ? null : i);
                                                            setMobileExpandedChild(null);
                                                        }}
                                                        aria-label={`Toggle ${cat.label}`}
                                                        className="p-1"
                                                    >
                                                        <svg
                                                            className={`w-3 h-3 transition-transform ${
                                                                expanded ? 'rotate-180' : ''
                                                            }`}
                                                            viewBox="0 0 12 12"
                                                            fill="currentColor"
                                                        >
                                                            <path d="M3 5 L6 8 L9 5" />
                                                        </svg>
                                                    </button>
                                                )}
                                            </div>
                                            {hasKids && expanded && (
                                                <div className="ml-3 mt-1 space-y-1">
                                                    {cat.children.map((child, ci) => {
                                                        const hasGrand = (child.children?.length ?? 0) > 0;
                                                        const childExpanded = mobileExpandedChild === ci;
                                                        return (
                                                            <div key={child.slug}>
                                                                <div className="flex items-center justify-between gap-2">
                                                                    <Link
                                                                        href={buildHref(cat.slug, child.slug)}
                                                                        onClick={() => setMobileMenuOpen(false)}
                                                                        className="text-sm text-body hover:text-brand transition-colors block py-1 flex-1"
                                                                    >
                                                                        {child.label}
                                                                    </Link>
                                                                    {hasGrand && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() =>
                                                                                setMobileExpandedChild(
                                                                                    childExpanded ? null : ci,
                                                                                )
                                                                            }
                                                                            aria-label={`Toggle ${child.label}`}
                                                                            className="p-1"
                                                                        >
                                                                            <svg
                                                                                className={`w-3 h-3 transition-transform ${
                                                                                    childExpanded ? 'rotate-180' : ''
                                                                                }`}
                                                                                viewBox="0 0 12 12"
                                                                                fill="currentColor"
                                                                            >
                                                                                <path d="M3 5 L6 8 L9 5" />
                                                                            </svg>
                                                                        </button>
                                                                    )}
                                                                </div>
                                                                {hasGrand && childExpanded && (
                                                                    <div className="ml-3 mt-1 space-y-1">
                                                                        {child.children.map((grand) => (
                                                                            <Link
                                                                                key={grand.slug}
                                                                                href={buildHref(
                                                                                    cat.slug,
                                                                                    child.slug,
                                                                                    grand.slug,
                                                                                )}
                                                                                onClick={() => setMobileMenuOpen(false)}
                                                                                className="text-xs text-body hover:text-brand transition-colors block py-0.5"
                                                                            >
                                                                                {grand.label}
                                                                            </Link>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <Link
                        href="/register"
                        className="bg-brand hover:bg-brand-dark text-white text-xs font-semibold px-4 py-2.5 rounded transition-colors text-center"
                    >
                        CREATE WHOLESALE ACCOUNT
                    </Link>
                    {auth.isLoggedIn ? (
                        <Link
                            href="/dashboard"
                            className="text-sm font-medium text-heading hover:text-brand transition-colors text-center"
                        >
                            My Account
                        </Link>
                    ) : (
                        <Link
                            href="/login"
                            className="text-sm font-medium text-heading hover:text-brand transition-colors text-center"
                        >
                            Sign In / My Account
                        </Link>
                    )}
                    <form
                        onSubmit={handleSearch}
                        className="flex items-center border border-gray-200 rounded px-3 py-1 gap-2"
                    >
                        <button type="submit" aria-label="Search">
                            <svg
                                className="w-4 h-4 text-gray-400"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                            >
                                <circle cx="10" cy="10" r="7" />
                                <line x1="15" y1="15" x2="21" y2="21" strokeLinecap="round" />
                            </svg>
                        </button>
                        <input
                            type="text"
                            value={searchValue}
                            onChange={(e) => setSearchValue(e.target.value)}
                            placeholder="Search..."
                            className="text-sm bg-transparent w-full appearance-none border-0 outline-none focus:outline-none focus:ring-0 focus:border-0 p-[0.2rem]"
                        />
                    </form>
                </motion.div>
            )}

            <CartDrawer />
            <Toast />
        </header>
    );
}
