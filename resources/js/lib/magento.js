/* -------------------------------------------------------------------------- */
/*  Static Catalog Data Layer                                                  */
/*                                                                             */
/*  Reads from bundled JSON snapshots in resources/js/data instead of any      */
/*  live API. Same shape as the original Next.js version, ported to JS.        */
/* -------------------------------------------------------------------------- */

import productsData from '@/data/products.json';
import categoriesData from '@/data/categories.json';

const MEDIA_BASE = '/media/catalog/product';

function attr(product, code) {
    const a = product.custom_attributes.find((c) => c.attribute_code === code);
    if (!a) return '';
    return Array.isArray(a.value) ? a.value.join(',') : String(a.value);
}

function catAttr(cat, code) {
    if (!cat.custom_attributes) return '';
    const a = cat.custom_attributes.find((c) => c.attribute_code === code);
    return a ? a.value : '';
}

function imageUrl(file) {
    const cleanPath = file.replace(/^\/cache\/[^/]+\//, '/');
    return `${MEDIA_BASE}${cleanPath}`;
}

function findThumbnail(entries) {
    const thumb = entries.find(
        (e) => e.types.includes('thumbnail') || e.types.includes('image'),
    );
    return thumb ? imageUrl(thumb.file) : '';
}

function transformCategory(cat, parentPath = '') {
    const rawUrlKey = catAttr(cat, 'url_key');
    const urlKey =
        rawUrlKey ||
        cat.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');

    const rawUrlPath = catAttr(cat, 'url_path');
    const urlPath = rawUrlPath || (parentPath ? `${parentPath}/${urlKey}` : urlKey);

    return {
        id: cat.id,
        parentId: cat.parent_id,
        name: cat.name,
        level: cat.level,
        productCount: cat.product_count,
        urlKey,
        urlPath,
        children: (cat.children_data || []).map((child) =>
            transformCategory(child, urlPath),
        ),
    };
}

function transformProduct(p) {
    const images = p.media_gallery_entries.map((e) => ({
        file: e.file,
        url: imageUrl(e.file),
        types: e.types,
    }));

    const categoryIdsRaw = attr(p, 'category_ids');

    return {
        id: p.id,
        sku: p.sku,
        name: p.name,
        price: p.price,
        typeId: p.type_id,
        weight: p.weight,
        status: p.status,
        images,
        thumbnail: findThumbnail(p.media_gallery_entries),
        description: attr(p, 'description'),
        urlKey: attr(p, 'url_key'),
        categoryIds: Array.isArray(categoryIdsRaw)
            ? categoryIdsRaw
            : categoryIdsRaw.split(',').filter(Boolean),
        metaTitle: attr(p, 'meta_title'),
        metaDescription: attr(p, 'meta_description'),
        color: attr(p, 'color'),
        countryOfManufacture: attr(p, 'country_of_manufacture'),
        hasOptions: attr(p, 'has_options') === '1',
        configurableOptions: p.extension_attributes?.configurable_product_options,
        configurableLinks: p.extension_attributes?.configurable_product_links,
    };
}

const ALL_PRODUCTS = (productsData.items || []).map(transformProduct);
const ALL_CATEGORIES = (categoriesData.children_data ?? []).map((c) =>
    transformCategory(c, ''),
);

function paginate(items, page, pageSize) {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
}

export function getProducts(page = 1, pageSize = 12) {
    return {
        items: paginate(ALL_PRODUCTS, page, pageSize),
        total: ALL_PRODUCTS.length,
        page,
        pageSize,
    };
}

export function getProductBySku(sku) {
    return ALL_PRODUCTS.find((p) => p.sku === sku) ?? null;
}

export function getProductByUrlKey(urlKey) {
    return ALL_PRODUCTS.find((p) => p.urlKey === urlKey) ?? null;
}

export function getProductBySlug(slug) {
    return getProductByUrlKey(slug) ?? getProductBySku(slug);
}

export function getAllProducts() {
    return ALL_PRODUCTS;
}

export function searchProducts(query, page = 1, pageSize = 24) {
    const q = (query || '').toLowerCase();
    const filtered = ALL_PRODUCTS.filter((p) => p.name.toLowerCase().includes(q));
    return {
        items: paginate(filtered, page, pageSize),
        total: filtered.length,
        page,
        pageSize,
    };
}

export function getCategories() {
    return ALL_CATEGORIES;
}

function findCategoryByUrlKey(categories, urlKey) {
    for (const cat of categories) {
        if (cat.urlKey === urlKey) return cat;
        const found = findCategoryByUrlKey(cat.children, urlKey);
        if (found) return found;
    }
    return null;
}

export function getCategoryByUrlKey(urlKey) {
    return findCategoryByUrlKey(ALL_CATEGORIES, urlKey);
}

export function getProductsByCategory(categoryId, page = 1, pageSize = 24) {
    const idStr = String(categoryId);
    const filtered = ALL_PRODUCTS.filter((p) => p.categoryIds.includes(idStr));
    return {
        items: paginate(filtered, page, pageSize),
        total: filtered.length,
        page,
        pageSize,
    };
}

function flattenCategories(cats, map) {
    for (const cat of cats) {
        map.set(String(cat.id), {
            name: cat.name,
            urlKey: cat.urlKey,
            urlPath: cat.urlPath,
        });
        flattenCategories(cat.children, map);
    }
}

export function getCategoryLookup() {
    const map = new Map();
    flattenCategories(ALL_CATEGORIES, map);
    return Object.fromEntries(map);
}
