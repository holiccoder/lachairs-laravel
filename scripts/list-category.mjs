// List all product URLs on an eventstable.com category page and merge them
// into scripts/product-urls.json (dedup by URL).
//
// Run:  node scripts/list-category.mjs <category-url>
// e.g.  node scripts/list-category.mjs https://www.eventstable.com/resin-folding-chairs

import { chromium } from 'playwright';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { categoryFromUrl } from './scrape-product.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const URLS_FILE = join(__dirname, 'product-urls.json');

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
const CATEGORY = nextArg('--category');
const OUTPUT_FILE = nextArg('--output') || URLS_FILE;
const arg = args.find((a) => !a.startsWith('--'));
if (!arg) {
  console.error('Usage: node scripts/list-category.mjs <category-url> [--proxy [http://host:port]] [--category <folder>] [--output <urls-file>]');
  process.exit(1);
}
// Force product_list_limit=36 so all items render on one page (eventstable
// caps at 13/24/36; 36 fits everything we've seen so far).
const url = arg.includes('?') ? `${arg}&product_list_limit=36` : `${arg}?product_list_limit=36`;
// Category folder name = the listing page's last path segment, e.g.
//   /resin-folding-chairs?... → "resin-folding-chairs"
// This is also what the product URLs use (/resin-folding-chairs/foo.html),
// so they'll match. Bare-domain product URLs from this listing get tagged
// with this same category, even though their URL lacks the prefix.
const listingCategory = CATEGORY || new globalThis.URL(arg).pathname.split('/').filter(Boolean).pop();

const browser = await chromium.launch({ headless: true });
const contextOptions = {
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
};
if (PROXY) {
  contextOptions.proxy = { server: PROXY };
  console.log(`Using proxy: ${PROXY}`);
}
const context = await browser.newContext(contextOptions);
// Same Klaviyo/tracking block as the batch scraper — keeps the page snappy.
await context.route(
  /(klaviyo|d3k81ch9hvuctc\.cloudfront\.net|googletagmanager|google-analytics|facebook\.net|hotjar|clarity\.ms|doubleclick)/,
  (route) => route.abort(),
);
const page = await context.newPage();

const seenHrefs = new Set();
const found = [];
let currentUrl = url;
let pageNum = 1;

while (true) {
  console.log(`Loading page ${pageNum}: ${currentUrl}`);
  await page.goto(currentUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('li.product-item, .product-item-info', { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1500);

  const pageItems = await page.evaluate(() => {
    const items = document.querySelectorAll('li.product-item, .product-item-info');
    const pageSeen = new Set();
    const out = [];
    items.forEach((el) => {
      const a = el.querySelector('a.product-item-link, .product-item-link');
      if (!a) return;
      const href = a.href.split('?')[0];
      if (pageSeen.has(href)) return;
      pageSeen.add(href);
      out.push({ name: a.textContent.trim().replace(/\s+/g, ' '), url: href });
    });
    return out;
  });

  for (const item of pageItems) {
    if (seenHrefs.has(item.url)) continue;
    seenHrefs.add(item.url);
    found.push(item);
  }

  const nextHref = await page.evaluate(() => {
    const next = document.querySelector('.pages-item-next a, a.action.next');
    if (!next) return null;
    const li = next.closest('li');
    if (li && li.classList.contains('disabled')) return null;
    return next.href;
  });
  if (!nextHref) break;
  currentUrl = new globalThis.URL(nextHref, currentUrl).href;
  pageNum += 1;
}

await browser.close();

console.log(`Found ${found.length} products across ${pageNum} page(s).`);

// Tag each product with the listing's category so bare-domain product URLs
// still end up in the right output subfolder. Category-prefixed URLs match
// the listing's category by construction, so this is also a no-op for them.
for (const p of found) {
  p.category = listingCategory;
}

// Merge with the target URLs file — dedup by URL, preserve existing order, append new ones.
const existing = existsSync(OUTPUT_FILE) ? JSON.parse(readFileSync(OUTPUT_FILE, 'utf8')) : [];
const existingUrls = new Set(existing.map((p) => p.url));
const added = [];
for (const p of found) {
  if (!existingUrls.has(p.url)) {
    existing.push(p);
    existingUrls.add(p.url);
    added.push(p);
  }
}

writeFileSync(OUTPUT_FILE, JSON.stringify(existing, null, 2), 'utf8');

console.log(`\nAdded ${added.length} new products to ${OUTPUT_FILE}:`);
added.forEach((p) => console.log(`  + ${p.name}\n    ${p.url}`));
console.log(`\nTotal in product-urls.json: ${existing.length}`);
