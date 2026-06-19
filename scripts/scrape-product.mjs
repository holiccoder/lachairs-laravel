// Scraper for a single eventstable.com product page.
//
// As a CLI:    node scripts/scrape-product.mjs <product-url>
//   -> writes scripts/output/<slug>.json (skipped if it exists; --force to overwrite)
//
// As a module: import { scrapeProduct } from './scrape-product.mjs'
//   const data = await scrapeProduct(page, url);

import { chromium } from 'playwright';
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const OUT_DIR = join(__dirname, 'output');

export const slugFromUrl = (u) =>
  new globalThis.URL(u).pathname.split('/').filter(Boolean).pop().replace(/\.html?$/i, '');

// Derive a category folder name from the URL path. /<category>/<slug>.html
// puts the file in <category>/; bare /<slug>.html falls back to "uncategorized".
export const categoryFromUrl = (u) => {
  const segments = new globalThis.URL(u).pathname.split('/').filter(Boolean);
  return segments.length >= 2 ? segments[0] : 'uncategorized';
};

// Where a given product URL's JSON should live.
export const outputPathForUrl = (u, category) =>
  join(OUT_DIR, category || categoryFromUrl(u), `${slugFromUrl(u)}.json`);

const stripQS = (u) => (u ? u.split('?')[0] : u);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function gatherGalleryImages(page) {
  // Fotorama lazy-loads thumbs as they scroll into view in the strip.
  // Force-load every thumb by scrolling each into view.
  await page.evaluate(async () => {
    const frames = document.querySelectorAll('.fotorama__nav__frame--thumb');
    for (const f of frames) {
      f.scrollIntoView({ block: 'nearest', inline: 'center' });
      await new Promise((r) => setTimeout(r, 30));
    }
  });
  await sleep(300);

  return page.evaluate(() => {
    const urls = new Set();
    // Primary: thumbnail strip (the standard configurable product gallery).
    document.querySelectorAll('.fotorama__nav__frame--thumb img').forEach((img) => {
      if (img.src) urls.add(img.src);
    });
    // Fallback: bundle/single-image products only have a stage frame, no nav strip.
    if (urls.size === 0) {
      document.querySelectorAll('.fotorama__stage__frame img, img[itemprop="image"]').forEach((img) => {
        if (img.src) urls.add(img.src);
      });
    }
    return Array.from(urls);
  });
}

async function getColorSwatches(page) {
  return page.evaluate(() => {
    const swatches = document.querySelectorAll('.swatch-attribute-options .swatch-option');
    return Array.from(swatches).map((el) => ({
      label: el.getAttribute('data-option-label') || el.getAttribute('aria-label'),
      optionId: el.getAttribute('data-option-id'),
      selected: el.classList.contains('selected') || el.getAttribute('aria-checked') === 'true',
      swatchImage:
        el.getAttribute('data-option-tooltip-thumb') ||
        el.getAttribute('data-option-tooltip-value'),
    }));
  });
}

async function clickSwatchByLabel(page, label) {
  const handle = await page.$(
    `.swatch-attribute-options .swatch-option[data-option-label="${label.replace(/"/g, '\\"')}"]`,
  );
  if (!handle) return false;
  await handle.scrollIntoViewIfNeeded();
  // force:true bypasses the actionability check, so a Klaviyo popup or
  // sticky banner that overlays the swatch can't block the click.
  await handle.click({ force: true });
  await sleep(600); // gallery refresh
  return true;
}

async function extractStaticData(page) {
  return page.evaluate(() => {
    const txt = (sel) => {
      const el = document.querySelector(sel);
      return el ? el.textContent.trim().replace(/\s+/g, ' ') : null;
    };

    const title = txt('h1.page-title .base, h1.page-title');
    const sku = txt('[itemprop="sku"]') || txt('.product.attribute.sku .value');
    const price = txt('.product-info-price .price-wrapper, .product-info-price .price');

    // Features — overview is short bullets (or prose), description is long copy.
    // Both are sentence-split, prefer real <li> bullets when present.
    const collectSentences = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return [];
      const clone = el.cloneNode(true);
      clone.querySelectorAll('style, script').forEach((n) => n.remove());
      const lis = Array.from(clone.querySelectorAll('li'))
        .map((li) => li.textContent.trim().replace(/\s+/g, ' '))
        .filter(Boolean);
      if (lis.length) return lis;
      const text = clone.textContent.trim().replace(/\s+/g, ' ');
      return text
        .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
        .map((s) => s.trim())
        .filter((s) => s.length > 10);
    };

    const overview = collectSentences('.product.attribute.overview');
    const description = collectSentences('.product.attribute.description');
    const seen = new Set();
    const features = [...overview, ...description].filter((s) => {
      const k = s.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    // Specifications — Magento additional-attributes table.
    const specs = {};
    document
      .querySelectorAll('table.additional-attributes tbody tr, table#product-attribute-specs-table tbody tr')
      .forEach((tr) => {
        const k = tr.querySelector('th')?.textContent.trim();
        const v = tr.querySelector('td')?.textContent.trim().replace(/\s+/g, ' ');
        if (k) specs[k] = v;
      });

    // FAQ — eventstable's .faq_que_ans / .faq_product_question / .faq_product_answer
    const faq = Array.from(document.querySelectorAll('.faq_que_ans'))
      .map((node) => ({
        question: node.querySelector('.faq_product_question')?.textContent.trim() || null,
        answer: node.querySelector('.faq_product_answer')?.textContent.trim().replace(/\s+/g, ' ') || null,
      }))
      .filter((f) => f.question && f.answer);

    return { title, sku, price, features, specs, faq };
  });
}

/**
 * Scrape one product page and return the trimmed JSON shape.
 * Caller supplies the page; we go to the URL and do the work.
 */
export async function scrapeProduct(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  // Gallery thumb-strip wait — bundles don't have one, so don't block long.
  await page.waitForSelector('.fotorama__nav__frame--thumb', { timeout: 8000 }).catch(() => {});
  await page.waitForSelector('.swatch-attribute-options .swatch-option', { timeout: 5000 }).catch(() => {});
  // Fallback: wait for SOME gallery image (stage frame) for single-image products.
  await page.waitForSelector('.fotorama__stage__frame img, img[itemprop="image"]', { timeout: 8000 }).catch(() => {});
  await sleep(1000);

  const staticData = await extractStaticData(page);
  const swatches = await getColorSwatches(page);
  const defaultColor = swatches.find((s) => s.selected)?.label || null;
  const defaultGallery = (await gatherGalleryImages(page)).map(stripQS);

  const colors = [];
  for (const s of swatches) {
    const ok = await clickSwatchByLabel(page, s.label);
    let gallery = [];
    if (ok) {
      gallery = [...new Set((await gatherGalleryImages(page)).map(stripQS))];
    }
    colors.push({
      label: s.label,
      swatchImage: stripQS(s.swatchImage),
      gallery,
    });
  }

  return {
    title: staticData.title,
    sku: staticData.sku,
    brand: staticData.specs?.Brand || null,
    price: staticData.price,
    features: staticData.features,
    specifications: staticData.specs,
    faq: staticData.faq,
    defaultColor,
    defaultGallery,
    colors,
  };
}

// CLI mode — only runs when invoked directly, not when imported.
const isDirectInvocation = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isDirectInvocation) {
  const args = process.argv.slice(2);
  function nextArg(flag) {
    const idx = args.indexOf(flag);
    if (idx === -1) return undefined;
    const val = args[idx + 1];
    return val && !val.startsWith('--') ? val : undefined;
  }
  const PROXY = args.includes('--proxy')
    ? (nextArg('--proxy') || process.env.PROXY || 'http://127.0.0.1:7890')
    : null;
  const force = args.includes('--force');
  const CATEGORY = args.includes('--category') ? args[args.indexOf('--category') + 1] : null;
  const url = args.find((a) => !a.startsWith('--'));
  if (!url) {
    console.error('Usage: node scripts/scrape-product.mjs <product-url> [--force] [--category <folder>] [--proxy [http://host:port]]');
    process.exit(1);
  }
  const out = outputPathForUrl(url, CATEGORY);
  const outDir = dirname(out);
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  if (existsSync(out) && !force) {
    console.log(`Already scraped: ${out} (pass --force to overwrite)`);
    process.exit(0);
  }

  console.log(`Launching Chromium for ${url}`);
  const browser = await chromium.launch({ headless: true });
  const contextOptions = {
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 900 },
  };
  if (PROXY) {
    contextOptions.proxy = { server: PROXY };
    console.log(`Using proxy: ${PROXY}`);
  }
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  try {
    const data = await scrapeProduct(page, url);
    writeFileSync(out, JSON.stringify(data, null, 2), 'utf8');
    console.log(`Wrote ${out}`);
    console.log(`  title: ${data.title}`);
    console.log(`  colors: ${data.colors.length}, defaultGallery: ${data.defaultGallery.length} image(s)`);
  } finally {
    await browser.close();
  }
}
