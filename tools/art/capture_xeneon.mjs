import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const slug = process.argv[2];
const outDir = process.argv[3];
if (!slug || !outDir) {
  throw new Error('usage: node tools/art/capture_xeneon.mjs <slug> <out-dir>');
}

const entry = path.resolve(`widgets/${slug}/index.html`);
const fixturePath = path.resolve(`widgets/_src/${slug}/rat-art.mjs`);
await fs.access(entry);
await fs.access(fixturePath);
await fs.mkdir(outDir, { recursive: true });

const fixture = await import(pathToFileURL(fixturePath).href);
if (typeof fixture.prepare !== 'function') {
  throw new Error(`Rat Art fixture must export prepare(page, context): ${fixturePath}`);
}
if (typeof fixture.ready !== 'function') {
  throw new Error(`Rat Art fixture must export ready(page, context): ${fixturePath}`);
}

const slots = {
  S_H: [840, 344],
  S_V: [696, 416],
  M_H: [840, 696],
  M_V: [696, 840],
  L_H: [1688, 696],
  L_V: [696, 1688],
  XL_H: [2536, 696],
  XL_V: [696, 2536],
};

const browser = await chromium.launch({ headless: true });

function safeVariantName(value) {
  const safe = String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  if (!safe) throw new Error(`invalid Rat Art variant name: ${value}`);
  return safe;
}

async function openPage(slotName, width, height, variant = null) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  const runtimeErrors = [];
  page.on('pageerror', (error) => runtimeErrors.push(`pageerror: ${String(error)}`));
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(`console: ${message.text()}`);
  });

  const context = { slug, slot: slotName, width, height, variant };
  await fixture.prepare(page, context);
  await page.goto(pathToFileURL(entry).href, { waitUntil: 'load' });
  await fixture.ready(page, context);

  const geometry = await page.evaluate(() => ({
    overflowX: document.documentElement.scrollWidth - innerWidth,
    overflowY: document.documentElement.scrollHeight - innerHeight,
  }));
  if (geometry.overflowX > 0.5 || geometry.overflowY > 0.5) {
    throw new Error(`overflow detected for ${slotName}: ${JSON.stringify(geometry)}`);
  }

  if (typeof fixture.assert === 'function') {
    await fixture.assert(page, context);
  }
  if (runtimeErrors.length) {
    throw new Error(`runtime errors for ${slotName}: ${runtimeErrors.join(' | ')}`);
  }
  return page;
}

try {
  for (const [name, [width, height]] of Object.entries(slots)) {
    const page = await openPage(name, width, height, null);
    await page.screenshot({ path: path.join(outDir, `${name}.png`) });
    await page.close();
  }

  const variants = Array.isArray(fixture.variants) ? fixture.variants : [];
  for (const variant of variants) {
    if (!variant || !variant.name) throw new Error('Rat Art variants require a name');
    const slotName = variant.slot || 'M_H';
    const dimensions = slots[slotName];
    if (!dimensions) throw new Error(`unknown Rat Art variant slot: ${slotName}`);
    const [width, height] = dimensions;
    const page = await openPage(slotName, width, height, variant);
    const fileName = `VARIANT_${safeVariantName(variant.name)}.png`;
    await page.screenshot({ path: path.join(outDir, fileName) });
    await page.close();
  }
} finally {
  await browser.close();
}

console.log(`RAT ART CAPTURE PASS: ${slug}`);
