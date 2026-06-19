import { useState } from 'react';
import { Head, Link } from '@inertiajs/react';
import Header from '@/Components/Header';
import Footer from '@/Components/Footer';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/hooks/useAuth';
import AddToCartButton from '@/Components/cart/AddToCartButton';
import QuantitySelector from '@/Components/cart/QuantitySelector';
import { getProductBySlug } from '@/lib/magento';

function formatPrice(price) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
    }).format(price);
}

export default function ProductPage({ slug, product: serverProduct }) {
    // DB-backed route passes a fully-shaped product; root-slug paths without a
    // DB match hit this without one, so fall back to the static-JSON snapshot.
    const product = serverProduct ?? getProductBySlug(slug);

    if (!product) {
        return (
            <>
                <Head title="Product Not Found" />
                <div className="flex flex-col min-h-screen bg-white">
                    <Header />
                    <div className="max-w-[1440px] mx-auto px-6 lg:px-12 py-20 text-center flex-1">
                        <h1 className="text-2xl font-bold text-heading mb-3">Product not found</h1>
                        <Link href="/products" className="text-brand">
                            Browse all products
                        </Link>
                    </div>
                    <Footer />
                </div>
            </>
        );
    }

    return (
        <>
            <Head title={`${product.name} | Lachairs`} />
            <div className="flex flex-col min-h-screen bg-white">
                <Header />

                <div className="max-w-[1440px] mx-auto px-6 lg:px-12 w-full pt-6 pb-2">
                    <nav className="flex items-center gap-1.5 text-xs text-gray-400 flex-wrap">
                        <Link href="/" className="hover:text-brand transition-colors">Home</Link>
                        <span>&gt;</span>
                        <span className="text-gray-500">{product.name}</span>
                    </nav>
                </div>

                <ProductClient product={product} />

                <Footer />
            </div>
        </>
    );
}

function ProductClient({ product }) {
    // Color variants come from the DB and may carry their own gallery. When
    // selected we show that gallery instead of the product's default images.
    const variants = Array.isArray(product.colorVariants) ? product.colorVariants : [];
    const variantsWithGallery = variants.filter((v) => Array.isArray(v.gallery) && v.gallery.length > 0);
    const [activeVariant, setActiveVariant] = useState(null);

    const activeImages =
        activeVariant !== null && variantsWithGallery[activeVariant]
            ? variantsWithGallery[activeVariant].gallery.map((url, i) => ({
                  file: url,
                  url,
                  types: i === 0 ? ['image', 'thumbnail'] : [],
              }))
            : product.images;

    const initialImage =
        activeImages.length > 0
            ? activeImages.find((i) => i.types.includes('image'))?.url || activeImages[0].url
            : '';

    const [selectedImage, setSelectedImage] = useState(initialImage);

    // Keep the hero image in sync when the user picks a color variant.
    if (activeImages.length > 0 && !activeImages.some((i) => i.url === selectedImage)) {
        setSelectedImage(activeImages[0].url);
    }

    const thumbnails = activeImages.slice(0, 6);

    const { addItem } = useCart();
    const { isLoggedIn } = useAuth();
    const [quantity, setQuantity] = useState(1);
    const [selectedOptions, setSelectedOptions] = useState({});
    const [isAdding, setIsAdding] = useState(false);
    const [activeTab, setActiveTab] = useState('description');

    const hasOptions = product.configurableOptions && product.configurableOptions.length > 0;
    const allOptionsSelected =
        !hasOptions ||
        product.configurableOptions.every(
            (opt) => selectedOptions[opt.attribute_id] !== undefined,
        );

    const handleAddToCart = () => {
        if (!allOptionsSelected || product.status !== 1) return;

        setIsAdding(true);

        const optionLabels = {};
        if (hasOptions) {
            product.configurableOptions.forEach((opt) => {
                optionLabels[opt.attribute_id] = opt.label;
            });
        }

        addItem({
            productId: product.id,
            sku: product.sku,
            name: product.name,
            price: isLoggedIn ? product.price : 0,
            quantity,
            image: thumbnails[0]?.url ?? '',
            selectedOptions: hasOptions ? { ...selectedOptions } : {},
            optionLabels,
            urlKey: product.urlKey || product.sku,
            typeId: product.typeId,
        });

        setTimeout(() => setIsAdding(false), 600);
    };

    // Build the spec rows: prefer DB-stored key/value pairs; fall back to a
    // minimal SKU+Type stub so the section is never empty.
    const dbSpecs = product.specifications && typeof product.specifications === 'object'
        ? Object.entries(product.specifications).filter(([, v]) => v !== null && v !== '')
        : [];

    const specs = dbSpecs.length > 0
        ? dbSpecs.map(([label, value]) => ({ label, value: String(value) }))
        : [
              { label: 'SKU', value: product.sku },
              ...(product.weight ? [{ label: 'Weight', value: `${product.weight} lbs` }] : []),
              {
                  label: 'Type',
                  value:
                      product.typeId === 'configurable'
                          ? 'Configurable Product'
                          : 'Simple Product',
              },
              ...(product.countryOfManufacture
                  ? [{ label: 'Country of Manufacture', value: product.countryOfManufacture }]
                  : []),
          ];

    const features = Array.isArray(product.features) ? product.features : [];
    const faq = Array.isArray(product.faq) ? product.faq : [];

    const tabs = [
        { id: 'description', label: 'Description', show: !!product.description },
        { id: 'features', label: 'Features', show: features.length > 0 },
        { id: 'specs', label: 'Specifications', show: specs.length > 0 },
        { id: 'faq', label: 'FAQ', show: faq.length > 0 },
    ].filter((t) => t.show);

    const safeActiveTab = tabs.some((t) => t.id === activeTab)
        ? activeTab
        : tabs[0]?.id ?? 'description';

    return (
        <div className="flex flex-col bg-white">
            <div className="max-w-[1440px] mx-auto px-6 lg:px-12 w-full pb-12">
                <div className="flex flex-col md:flex-row gap-8 lg:gap-12">
                    <div className="flex-1 max-w-[560px]">
                        <div className="aspect-square bg-gray-50 rounded-lg overflow-hidden mb-4 border border-gray-100">
                            {selectedImage ? (
                                <img
                                    src={selectedImage}
                                    alt={product.name}
                                    className="w-full h-full object-contain"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-300">
                                    <svg viewBox="0 0 48 48" className="w-16 h-16" fill="none" stroke="currentColor" strokeWidth="1">
                                        <rect x="6" y="10" width="36" height="28" rx="2" />
                                        <circle cx="17" cy="20" r="3" />
                                        <path d="M6 30 L18 22 L26 28 L36 18 L42 22 L42 38 L6 38Z" strokeLinejoin="round" />
                                    </svg>
                                </div>
                            )}
                        </div>

                        {thumbnails.length > 1 && (
                            <div className="flex gap-2 overflow-x-auto pb-1">
                                {thumbnails.map((img) => (
                                    <button
                                        key={img.file}
                                        onClick={() => setSelectedImage(img.url)}
                                        className={`w-16 h-16 md:w-20 md:h-20 shrink-0 rounded-md overflow-hidden border-2 transition-colors ${
                                            selectedImage === img.url
                                                ? 'border-brand'
                                                : 'border-gray-200 hover:border-gray-300'
                                        }`}
                                    >
                                        <img src={img.url} alt="" className="w-full h-full object-contain" />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="flex-1">
                        <p className="text-xs font-bold text-heading tracking-wide mb-2">
                            LACHAIRS COMMERCIAL PRODUCTS
                        </p>
                        <h1 className="text-2xl md:text-3xl font-bold text-heading mb-3">
                            {product.name}
                        </h1>

                        <div className="flex items-center gap-2 mb-3">
                            <span
                                className={`w-2 h-2 rounded-full ${
                                    product.status === 1 ? 'bg-green-500' : 'bg-red-500'
                                }`}
                            />
                            <span
                                className={`text-sm font-semibold ${
                                    product.status === 1 ? 'text-green-600' : 'text-red-600'
                                }`}
                            >
                                {product.status === 1 ? 'IN STOCK' : 'OUT OF STOCK'}
                            </span>
                        </div>

                        <p className="text-sm text-body mb-5">Item #: {product.sku}</p>

                        {variants.length > 0 && (
                            <div className="mb-5">
                                <p className="text-sm font-semibold text-heading mb-2">
                                    Color
                                    {variants[activeVariant ?? -1]?.label && (
                                        <span className="ml-2 font-normal text-body">
                                            {variants[activeVariant].label}
                                        </span>
                                    )}
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {variants.map((v, i) => {
                                        const swatch = v.swatch || '';
                                        const isHex = /^#[0-9a-fA-F]{3,8}$/.test(swatch);
                                        const isImage = swatch && !isHex;
                                        const variantHasGallery =
                                            Array.isArray(v.gallery) && v.gallery.length > 0;
                                        const variantIdx = variantHasGallery
                                            ? variantsWithGallery.findIndex((g) => g === v)
                                            : -1;
                                        const isActive = activeVariant === variantIdx && variantIdx !== -1;
                                        return (
                                            <button
                                                key={`${v.label}-${i}`}
                                                type="button"
                                                onClick={() => {
                                                    if (variantIdx !== -1) setActiveVariant(variantIdx);
                                                }}
                                                title={v.label || ''}
                                                className={`w-10 h-10 rounded-full border-2 overflow-hidden transition-colors ${
                                                    isActive
                                                        ? 'border-brand'
                                                        : 'border-gray-200 hover:border-gray-400'
                                                }`}
                                                style={isHex ? { backgroundColor: swatch } : undefined}
                                            >
                                                {isImage && (
                                                    <img
                                                        src={`/${swatch.replace(/^\//, '')}`}
                                                        alt={v.label || ''}
                                                        className="w-full h-full object-cover"
                                                    />
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        <div className="border-t border-gray-200 pt-6 mt-6">
                            {isLoggedIn ? (
                                <p className="text-2xl font-bold text-heading mb-5">
                                    {formatPrice(product.price)}
                                </p>
                            ) : (
                                <Link
                                    href="/login"
                                    className="inline-flex items-center gap-1.5 text-brand hover:text-brand-dark font-semibold text-lg transition-colors mb-5"
                                >
                                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <rect x="3" y="11" width="18" height="11" rx="2" />
                                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                    </svg>
                                    Login or Register to View Prices &amp; Options
                                </Link>
                            )}

                            {isLoggedIn && hasOptions && (
                                <div className="mb-5 space-y-4">
                                    {product.configurableOptions.map((opt) => (
                                        <div key={opt.id}>
                                            <label className="block text-sm font-semibold text-heading mb-2">
                                                {opt.label}
                                            </label>
                                            <div className="flex flex-wrap gap-2">
                                                {opt.values.map((v) => (
                                                    <button
                                                        key={v.value_index}
                                                        type="button"
                                                        onClick={() =>
                                                            setSelectedOptions((prev) => ({
                                                                ...prev,
                                                                [opt.attribute_id]: v.value_index,
                                                            }))
                                                        }
                                                        className={`px-4 py-2 text-sm border rounded transition-colors ${
                                                            selectedOptions[opt.attribute_id] === v.value_index
                                                                ? 'border-brand bg-brand/5 text-brand font-medium'
                                                                : 'border-gray-300 text-body hover:border-gray-400'
                                                        }`}
                                                    >
                                                        {v.value_index}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {isLoggedIn && (
                                <>
                                    <div className="flex items-center gap-4">
                                        <QuantitySelector value={quantity} onChange={setQuantity} min={1} />
                                        <AddToCartButton
                                            onClick={handleAddToCart}
                                            disabled={!allOptionsSelected || product.status !== 1}
                                            loading={isAdding}
                                        />
                                    </div>

                                    {product.status !== 1 && (
                                        <p className="mt-3 text-sm text-red-600 font-medium">
                                            This item is currently out of stock.
                                        </p>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-[1440px] mx-auto px-6 lg:px-12 w-full pb-16">
                {tabs.length > 0 && (
                    <div className="flex gap-8 border-b border-gray-200 mb-8 overflow-x-auto">
                        {tabs.map((t) => {
                            const isActive = t.id === safeActiveTab;
                            return (
                                <button
                                    key={t.id}
                                    type="button"
                                    onClick={() => setActiveTab(t.id)}
                                    className={`pb-3 text-sm font-semibold relative whitespace-nowrap transition-colors ${
                                        isActive ? 'text-heading' : 'text-gray-400 hover:text-body'
                                    }`}
                                >
                                    {t.label}
                                    {isActive && (
                                        <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-heading" />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                )}

                {safeActiveTab === 'description' && (
                    <div className="bg-[#F5F5F5] rounded-lg p-8 md:p-10">
                        {product.description ? (
                            <div
                                className="text-sm md:text-base text-body leading-relaxed prose prose-sm max-w-none"
                                dangerouslySetInnerHTML={{
                                    __html: product.description.replace(/\r\n/g, '<br/>'),
                                }}
                            />
                        ) : (
                            <p className="text-sm text-body">No description available.</p>
                        )}
                    </div>
                )}

                {safeActiveTab === 'features' && features.length > 0 && (
                    <div className="bg-[#F5F5F5] rounded-lg p-8 md:p-10">
                        <ul className="space-y-3">
                            {features.map((f, i) => (
                                <li key={i} className="flex gap-3 text-sm md:text-base text-body leading-relaxed">
                                    <span className="text-brand mt-1.5 shrink-0 w-1.5 h-1.5 rounded-full bg-brand" />
                                    <span>{f}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {safeActiveTab === 'specs' && (
                    <div className="bg-[#F5F5F5] rounded-lg p-8 md:p-10">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-3">
                            {specs.map((spec) => (
                                <div
                                    key={spec.label}
                                    className="flex justify-between py-2.5 border-b border-gray-200 text-sm"
                                >
                                    <span className="text-body">{spec.label}</span>
                                    <span className="text-heading font-medium text-right ml-4">
                                        {spec.value}
                                    </span>
                                </div>
                            ))}
                        </div>

                        <div className="mt-8 pt-4 border-t border-gray-200">
                            <p className="text-xs text-body leading-relaxed">
                                <span className="font-semibold text-heading">Prop 65 Message: </span>
                                This product can expose you to chemicals including wood dust, which is known to
                                the State of California to cause cancer. For more information, visit{' '}
                                <a
                                    href="https://www.P65Warnings.ca.gov"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-brand hover:text-brand-dark underline transition-colors"
                                >
                                    www.P65Warnings.ca.gov
                                </a>
                                .
                            </p>
                        </div>
                    </div>
                )}

                {safeActiveTab === 'faq' && faq.length > 0 && (
                    <div className="bg-[#F5F5F5] rounded-lg p-8 md:p-10">
                        <ul className="space-y-4 divide-y divide-gray-200">
                            {faq.map((row, i) => (
                                <li key={i} className="pt-4 first:pt-0">
                                    <p className="text-sm md:text-base font-semibold text-heading mb-2">
                                        {row.question}
                                    </p>
                                    <p className="text-sm text-body leading-relaxed whitespace-pre-line">
                                        {row.answer}
                                    </p>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
}
