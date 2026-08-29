#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { prepare, ready, assert as assertFixture } from '../../widgets/_src/net-dashboard/rat-art.mjs';

const entry = process.argv[2];
const outDir = path.resolve(process.argv[3] || 'artifacts/net-dashboard-review-demo');
if (!entry || !fs.existsSync(entry)) {
  console.error('usage: node tools/xeneon/net-dashboard-review-demo.mjs <exact-packaged-index.html> [output-dir]');
  process.exit(2);
}
fs.mkdirSync(outDir, { recursive: true });

const report = {
  schema_version: 1,
  entry: path.basename(entry),
  evidence_type: 'deterministic simulated HTTPS probe fixture',
  live_network: false,
  disclosure: 'This recording exercises the exact packaged Network Dashboard with deterministic HTTPS probe and throughput fixtures. It demonstrates widget logic, history rendering, probe-loss gaps, host state, settings lifecycle, and interaction without claiming the recording is a live network measurement.',
  passed: false,
};

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1688, height: 696 },
  recordVideo: { dir: outDir, size: { width: 1688, height: 696 } },
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(String(error)));
let exitCode = 0;

try {
  const fixtureContext = { slot: 'L_H' };
  await prepare(page, fixtureContext);
  await page.goto(pathToFileURL(path.resolve(entry)).href, { waitUntil: 'load', timeout: 30_000 });
  await ready(page, fixtureContext);
  await assertFixture(page, fixtureContext);

  await page.waitForTimeout(1200);
  const before = await page.evaluate(() => ({
    state: document.body.getAttribute('data-state'),
    ping: document.getElementById('pingValue')?.textContent?.trim() || '',
    jitter: document.getElementById('jitterValue')?.textContent?.trim() || '',
    loss: document.getElementById('lossValue')?.textContent?.trim() || '',
    down: document.getElementById('downValue')?.textContent?.trim() || '',
    up: document.getElementById('upValue')?.textContent?.trim() || '',
    hosts: document.querySelectorAll('.host-row').length,
    window: document.getElementById('windowBadge')?.textContent?.trim() || '',
  }));

  await page.locator('#ribbonPanel').click();
  await page.waitForTimeout(1200);
  const afterWindow = await page.evaluate(() => document.getElementById('windowBadge')?.textContent?.trim() || '');
  if (!afterWindow || afterWindow === before.window) throw new Error(`time-window interaction did not change: ${before.window}`);

  await page.evaluate(() => {
    globalThis.textColor = '#FFF4D6';
    globalThis.accentColor = '#FFB84D';
    globalThis.backgroundColor = '#140C06';
    globalThis.icueEvents?.onDataUpdated?.();
  });
  await page.waitForTimeout(1400);

  const style = await page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    const body = getComputedStyle(document.body);
    return {
      text: cs.getPropertyValue('--text').trim() || body.getPropertyValue('--text').trim(),
      accent: cs.getPropertyValue('--accent').trim() || body.getPropertyValue('--accent').trim(),
      background: cs.getPropertyValue('--bg').trim() || cs.getPropertyValue('--background').trim() || body.getPropertyValue('--bg').trim(),
    };
  });

  await page.screenshot({ path: path.join(outDir, 'net-dashboard-review-final.png'), fullPage: true });
  report.before = before;
  report.afterWindow = afterWindow;
  report.style = style;
  report.pageErrors = errors;
  if (errors.length) throw new Error(`page errors: ${JSON.stringify(errors)}`);
  if (before.hosts < 3 || before.ping === '--' || before.jitter === '--' || before.loss === '--') {
    throw new Error(`network metrics missing: ${JSON.stringify(before)}`);
  }
  report.passed = true;
} catch (error) {
  report.error = String(error?.stack || error);
  report.pageErrors = errors;
  exitCode = 1;
} finally {
  const video = page.video();
  await page.close();
  await context.close();
  if (video) {
    try {
      const recorded = await video.path();
      const target = path.join(outDir, 'net-dashboard-review-demo.webm');
      if (path.resolve(recorded) !== path.resolve(target)) fs.copyFileSync(recorded, target);
      report.video = path.basename(target);
    } catch (error) {
      report.video_error = String(error?.stack || error);
      if (!exitCode) exitCode = 1;
    }
  }
  fs.writeFileSync(path.join(outDir, 'README.txt'), report.disclosure + '\n', 'utf8');
  fs.writeFileSync(path.join(outDir, 'net-dashboard-review-demo-result.json'), JSON.stringify(report, null, 2) + '\n');
  await browser.close();
}

console.log(JSON.stringify(report, null, 2));
process.exit(exitCode);
