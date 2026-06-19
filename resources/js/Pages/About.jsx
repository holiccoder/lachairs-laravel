import { Head } from '@inertiajs/react';
import Header from '@/Components/Header';
import Footer from '@/Components/Footer';

export default function AboutPage() {
    return (
        <>
            <Head title="About Us | Lachairs Commercial Products" />
            <div className="flex flex-col min-h-screen bg-white">
                <Header />

                <div className="max-w-[1440px] mx-auto px-6 lg:px-12 py-16">
                    <h1 className="text-3xl md:text-4xl font-bold text-heading mb-8">About Us</h1>

                    <div className="max-w-3xl space-y-6 text-body leading-relaxed">
                        <p>
                            Lachairs Commercial Products is a premier supplier of commercial-grade furniture
                            and equipment, proudly serving event professionals, hospitality venues, and
                            interior designers across the United States and Canada. Founded with a mission to
                            simplify the sourcing process for business buyers, we combine extensive inventory,
                            competitive pricing, and exceptional customer service to deliver an unmatched
                            experience.
                        </p>

                        <h2 className="text-xl font-bold text-heading mt-10 mb-3">Our Story</h2>
                        <p>
                            What began as a small family-operated warehouse in Los Angeles has grown into a
                            nationwide operation with distribution centers in Houston, Texas, and the New York
                            metro area. Over the past two decades, we&apos;ve partnered with thousands of event
                            rental companies, hotels, convention centers, and design firms — earning a
                            reputation for reliability, quality, and deep industry expertise.
                        </p>

                        <h2 className="text-xl font-bold text-heading mt-10 mb-3">Our Mission</h2>
                        <p>
                            We believe that sourcing commercial furniture should be straightforward. Our
                            platform gives business customers access to transparent inventory data, bulk
                            purchasing options, and dedicated account management — all designed to save time
                            and reduce friction in the procurement process.
                        </p>

                        <h2 className="text-xl font-bold text-heading mt-10 mb-3">What We Offer</h2>
                        <ul className="list-disc list-inside space-y-2">
                            <li>Wholesale pricing tailored for B2B buyers</li>
                            <li>Extensive in-stock inventory ready to ship</li>
                            <li>Custom manufacturing options for designers and venues</li>
                            <li>Dedicated account managers and white-glove support</li>
                            <li>Commercial-grade warranties on every product</li>
                        </ul>

                        <h2 className="text-xl font-bold text-heading mt-10 mb-3">Get in Touch</h2>
                        <p>
                            Interested in opening a wholesale account or learning more about our capabilities?
                            Visit our Contact page or apply for a Trade Account to get started.
                        </p>
                    </div>
                </div>

                <Footer />
            </div>
        </>
    );
}
