#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const entry = process.argv[2];
const outDir = path.resolve(process.argv[3] || 'artifacts/snake-settings');
if (!entry || !fs.existsSync(entry)) {
  console.error('usage: node tools/xeneon/snake-settings-smoke.mjs <exact-packaged-index.html> [output-dir]');
  process.exit(2);
}
fs.mkdirSync(outDir, { recursive: true });

const html = fs.readFileSync(entry, 'utf8');
if (!/<head(?:\s[^>]*)?>/i.test(html)) {
  console.error('packaged Snake is missing <head>');
  process.exit(2);
}

const harness = `<script id="ratpack-snake-settings-harness">
let themePreset = 'matrix';
let showTouchGuides = true;
let uniqueId = 'ratpack-snake-settings-smoke';
let iCUE_initialized = false;
globalThis.tr = async function (value) { return value; };
globalThis.__setRatpackSnakeSettings = function (next) {
  themePreset = String(next.theme);
  showTouchGuides = Boolean(next.guides);
};
</script>`;

const instrumentedHtml = html.replace(/<head(\s[^>]*)?>/i, (match) => match + '\n' + harness);
const instrumentedEntry = path.join(path.dirname(path.resolve(entry)), '__ratpack-snake-settings-instrumented.html');
fs.writeFileSync(instrumentedEntry, instrumentedHtml, 'utf8');

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1688, height: 696 } });
const errors = [];
page.on('pageerror', error => errors.push(String(error)));

const report = {
  schema_version: 2,
  evidence_type: 'exact packaged widget with document-level lexical iCUE property bindings',
  instrumentedEntry: path.basename(instrumentedEntry),
  passed: false,
};

let exitCode = 0;
try {
  await page.goto(pathToFileURL(instrumentedEntry).href, { waitUntil: 'load', timeout: 30_000 });
  await page.waitForFunction(() => document.body?.dataset?.theme === 'matrix');

  const initial = await page.evaluate(() => ({
    theme: document.body.dataset.theme,
    guides: document.body.dataset.guides,
    bridge: globalThis.__ratpackIcueBindingBridge || null,
    themeBinding: globalThis.themePreset,
    guidesBinding: globalThis.showTouchGuides,
    readerTheme: globalThis.__ratpackIcueRead?.('themePreset'),
    readerGuides: globalThis.__ratpackIcueRead?.('showTouchGuides'),
    lifecycle: typeof globalThis.icueEvents?.onDataUpdated,
  }));

  if (initial.bridge?.version !== 2 || initial.bridge?.mode !== 'direct-binding') {
    throw new Error(`Snake is not using hardened direct iCUE bindings: ${JSON.stringify(initial)}`);
  }
  if (initial.lifecycle !== 'function') throw new Error(`Snake onDataUpdated missing: ${JSON.stringify(initial)}`);
  if (initial.themeBinding !== 'matrix' || initial.guidesBinding !== true || initial.readerTheme !== 'matrix' || initial.readerGuides !== true) {
    throw new Error(`Snake initial lexical binding read failed: ${JSON.stringify(initial)}`);
  }

  await page.evaluate(() => {
    if (typeof globalThis.__setRatpackSnakeSettings !== 'function') throw new Error('Snake settings harness setter missing');
    globalThis.__setRatpackSnakeSettings({ theme: 'ember', guides: false });
    globalThis.icueEvents.onDataUpdated();
  });
  await page.waitForFunction(() => document.body.dataset.theme === 'ember' && document.body.dataset.guides === 'off');

  const updated = await page.evaluate(() => ({
    theme: document.body.dataset.theme,
    guides: document.body.dataset.guides,
    themeBinding: globalThis.themePreset,
    guidesBinding: globalThis.showTouchGuides,
    readerTheme: globalThis.__ratpackIcueRead?.('themePreset'),
    readerGuides: globalThis.__ratpackIcueRead?.('showTouchGuides'),
  }));
  if (updated.themeBinding !== 'ember' || updated.guidesBinding !== false || updated.readerTheme !== 'ember' || updated.readerGuides !== false) {
    throw new Error(`Snake updated lexical binding read failed: ${JSON.stringify(updated)}`);
  }

  await page.screenshot({ path: path.join(outDir, 'snake-ember-theme.png'), fullPage: true });
  report.initial = initial;
  report.updated = updated;
  report.pageErrors = errors;
  if (errors.length) throw new Error(`page errors: ${JSON.stringify(errors)}`);
  report.passed = true;
} catch (error) {
  report.error = String(error?.stack || error);
  report.pageErrors = errors;
  exitCode = 1;
} finally {
  fs.writeFileSync(path.join(outDir, 'snake-settings-result.json'), JSON.stringify(report, null, 2) + '\n');
  try { fs.unlinkSync(instrumentedEntry); } catch {}
  await browser.close();
}

console.log(JSON.stringify(report, null, 2));
process.exit(exitCode);
