import { Head, Link } from '@inertiajs/react';
import Header from '@/Components/Header';
import Footer from '@/Components/Footer';

export default function NotFoundPage({ status = 404 }) {
    return (
        <>
            <Head title="Page Not Found | Lachairs" />
            <div className="flex flex-col min-h-screen bg-[#F5F5F5]">
                <Header />

                <main className="flex-1 flex items-center justify-center px-6 py-20">
                    <div className="max-w-xl w-full text-center">
                        <p className="text-sm font-semibold text-brand uppercase tracking-widest mb-4">
                            Error {status}
                        </p>
                        <h1 className="text-5xl md:text-7xl font-bold text-heading mb-4 leading-none">
                            Page not found
                        </h1>
                        <p className="text-base text-body mb-10">
                            Sorry, we couldn’t find the page you were looking for. It may have
                            been moved, renamed, or no longer exists.
                        </p>

                        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                            <Link
                                href="/"
                                className="bg-brand hover:bg-brand-dark text-white text-sm font-semibold px-8 py-3 rounded transition-colors"
                            >
                                Back to home
                            </Link>
                            <Link
                                href="/products"
                                className="border border-gray-300 hover:border-heading text-heading text-sm font-semibold px-8 py-3 rounded transition-colors"
                            >
                                Browse products
                            </Link>
                            <Link
                                href="/contact"
                                className="text-sm font-medium text-body hover:text-heading transition-colors px-4 py-3"
                            >
                                Contact support →
                            </Link>
                        </div>
                    </div>
                </main>

                <Footer />
            </div>
        </>
    );
}
