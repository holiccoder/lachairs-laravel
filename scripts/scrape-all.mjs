// Batch scraper. Reads scripts/product-urls.json and writes one JSON per
// product into scripts/output/. Skips any product whose JSON already exists
// so re-running is safe and resumable.
//
// Run:  node scripts/scrape-all.mjs           (skips existing files)
//       node scripts/scrape-all.mjs --force   (re-scrape everything)

import { chromium } from 'playwright';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { scrapeProduct, outputPathForUrl, OUT_DIR } from './scrape-product.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
function nextArg(flag) {
  const idx = args.indexOf(flag);
  if (idx === -1) return undefined;
  const val = args[idx + 1];
  return val && !val.startsWith('--') ? val : undefined;
}
const URLS_FILE = nextArg('--urls-file') || join(__dirname, 'product-urls.json');
const FORCE = args.includes('--force');
const CATEGORY = args.includes('--category') ? args[args.indexOf('--category') + 1] : null;
const PROXY = args.includes('--proxy')
  ? (nextArg('--proxy') || process.env.PROXY || 'http://127.0.0.1:7890')
  : null;
const DELAY_MS = 1500; // polite delay between products (eventstable rate-limits at ~1.5s)

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

const list = JSON.parse(readFileSync(URLS_FILE, 'utf8'));
const visibleList = CATEGORY ? list.filter((i) => i.category === CATEGORY) : list;
if (CATEGORY) {
  console.log(`Category filter: ${CATEGORY} (${visibleList.length}/${list.length} products)`);
  if (!visibleList.length) {
    console.log('No products match this category.');
    process.exit(0);
  }
}

// Plan the work: split into to-do vs already-done.
const todo = [];
const skipped = [];
for (const item of visibleList) {
  const out = outputPathForUrl(item.url, item.category);
  if (existsSync(out) && !FORCE) {
    skipped.push(item.name);
  } else {
    todo.push({ ...item, out });
  }
}

console.log(`Total: ${visibleList.length}  | Already scraped: ${skipped.length}  | To do: ${todo.length}`);
if (skipped.length) {
  console.log('Skipping (already exist):');
  skipped.forEach((n) => console.log(`  - ${n}`));
}
if (!todo.length) {
  console.log('Nothing to do. Pass --force to re-scrape.');
  process.exit(0);
}

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
// Block Klaviyo (popup that intercepts swatch clicks) and other tracking junk.
// We don't need any of these to scrape product data.
await context.route(
  /(klaviyo|d3k81ch9hvuctc\.cloudfront\.net|googletagmanager|google-analytics|facebook\.net|hotjar|clarity\.ms|doubleclick)/,
  (route) => route.abort(),
);
const page = await context.newPage();

const failures = [];
let i = 0;
for (const item of todo) {
  i += 1;
  const label = `[${i}/${todo.length}] ${item.name}`;
  console.log(`\n${label}`);
  console.log(`  ${item.url}`);
  try {
    const data = await scrapeProduct(page, item.url);
    const outDir = dirname(item.out);
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
    writeFileSync(item.out, JSON.stringify(data, null, 2), 'utf8');
    const colorList = data.colors.map((c) => c.label).join(', ') || '(none)';
    console.log(`  ✓ ${data.colors.length} color(s) [${colorList}], ${data.defaultGallery.length} default gallery image(s)`);
    console.log(`  → ${item.out}`);
  } catch (err) {
    console.error(`  ✗ FAILED: ${err.message}`);
    failures.push({ ...item, error: err.message });
  }
  if (i < todo.length) await new Promise((r) => setTimeout(r, DELAY_MS));
}

await browser.close();

console.log('\n=== Done ===');
console.log(`Scraped: ${todo.length - failures.length}`);
console.log(`Failed:  ${failures.length}`);
if (failures.length) {
  console.log('Failed products:');
  failures.forEach((f) => console.log(`  - ${f.name}\n    ${f.url}\n    ${f.error}`));
  process.exit(1);
}
