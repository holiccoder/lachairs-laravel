// Scrape a list of eventstable.com category pages one by one.
// For each category it:
//   1. Lists every product URL on the category page(s)
//   2. Scrapes each product in that category (skips ones already done)
//
// Run:  node scripts/scrape-categories.mjs
//       node scripts/scrape-categories.mjs --proxy
//       node scripts/scrape-categories.mjs --proxy http://127.0.0.1:7890

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
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

const CATEGORY_DELAY_MS = 10000;
const LIST_RETRY_DELAY_MS = 20000;
const MAX_LIST_RETRIES = 2;

const CATEGORY_URLS = [
  'https://www.eventstable.com/resin-chiavari-chairs',
  'https://www.eventstable.com/cross-back-chairs',
  'https://www.eventstable.com/wood-chiavari-chairs',
  'https://www.eventstable.com/cross-back-chairs?material=944',
  'https://www.eventstable.com/throne-chairs',
  'https://www.eventstable.com/banquet-chairs',
  'https://www.eventstable.com/metal-stacking-chairs',
  'https://www.eventstable.com/metal-folding-chairs',
  'https://www.eventstable.com/resin-folding-chairs',
  'https://www.eventstable.com/farm-tables',
  'https://www.eventstable.com/cocktail-tables',
];

function run(cmd, runArgs, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, runArgs, { stdio: 'inherit', cwd: process.cwd(), ...options });
    child.on('close', (code) => resolve(code));
    child.on('error', (err) => {
      console.error('Spawn error:', err.message);
      resolve(1);
    });
  });
}

function runWithCapture(cmd, runArgs, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, runArgs, { stdio: ['inherit', 'pipe', 'inherit'], cwd: process.cwd(), ...options });
    let stdout = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
      process.stdout.write(chunk);
    });
    child.on('close', (code) => resolve({ code, stdout }));
    child.on('error', (err) => {
      console.error('Spawn error:', err.message);
      resolve({ code: 1, stdout });
    });
  });
}

function categoryFromUrl(url) {
  return new globalThis.URL(url).pathname.split('/').filter(Boolean).pop();
}

function parseListingResult(stdout) {
  const foundMatch = stdout.match(/Found (\d+) products? across (\d+) page\(s\)/);
  const addedMatch = stdout.match(/Added (\d+) new products? to product-urls\.json/);
  return {
    found: foundMatch ? parseInt(foundMatch[1], 10) : null,
    pages: foundMatch ? parseInt(foundMatch[2], 10) : null,
    added: addedMatch ? parseInt(addedMatch[1], 10) : null,
  };
}

async function listCategory(url, proxyArgs) {
  for (let attempt = 1; attempt <= MAX_LIST_RETRIES; attempt++) {
    if (attempt > 1) {
      console.log(`Listing returned 0/failed. Retrying in ${LIST_RETRY_DELAY_MS / 1000}s (attempt ${attempt}/${MAX_LIST_RETRIES})...`);
      await new Promise((r) => setTimeout(r, LIST_RETRY_DELAY_MS));
    }
    const { code, stdout } = await runWithCapture('node', [join(__dirname, 'list-category.mjs'), url, ...proxyArgs]);
    if (code !== 0) continue;
    const result = parseListingResult(stdout);
    if (result.found !== null && result.found > 0) return { ok: true, ...result };
  }
  return { ok: false };
}

async function main() {
  const proxyArgs = PROXY ? ['--proxy', PROXY] : [];

  console.log(`Scraping ${CATEGORY_URLS.length} categories`);
  if (PROXY) console.log(`Using proxy: ${PROXY}`);

  for (const url of CATEGORY_URLS) {
    const category = categoryFromUrl(url);
    console.log(`\n\n================ CATEGORY: ${category} ================`);
    console.log(`  ${url}`);

    console.log('\n-- Listing products --');
    const listResult = await listCategory(url, proxyArgs);
    if (!listResult.ok) {
      console.error(`Listing failed or returned 0 products for ${category} after ${MAX_LIST_RETRIES} attempts. Skipping.`);
      continue;
    }

    console.log('\n-- Scraping products --');
    const scrapeCode = await run('node', [
      join(__dirname, 'scrape-all.mjs'),
      '--category',
      category,
      ...proxyArgs,
    ]);
    if (scrapeCode !== 0) {
      console.error(`Some products failed in ${category} (exit ${scrapeCode}), continuing...`);
    }

    if (CATEGORY_DELAY_MS) {
      console.log(`Pausing ${CATEGORY_DELAY_MS / 1000}s before next category...`);
      await new Promise((r) => setTimeout(r, CATEGORY_DELAY_MS));
    }
  }

  console.log('\n=== All categories processed ===');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
