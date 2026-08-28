#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { prepare, ready, assert as assertFixture } from '../../widgets/_src/pc-power-meter/rat-art.mjs';

const entry = process.argv[2];
const outDir = path.resolve(process.argv[3] || 'artifacts/pc-power-review-demo');
if (!entry || !fs.existsSync(entry)) {
  console.error('usage: node tools/xeneon/pc-power-review-demo.mjs <exact-packaged-index.html> [output-dir]');
  process.exit(2);
}
fs.mkdirSync(outDir, { recursive: true });

const report = {
  schema_version: 1,
  entry: path.basename(entry),
  evidence_type: 'deterministic simulated iCUE Sensors provider',
  physical_hardware: false,
  disclosure: 'This recording exercises the exact packaged widget with RatPack deterministic Sensorsdataprovider fixtures. It demonstrates widget logic and provider lifecycle but is not evidence of a physical compatible PSU.',
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

let videoPath = null;
let exitCode = 0;
try {
  const fixtureContext = { slot: 'L_H' };
  await prepare(page, fixtureContext);
  await page.goto(pathToFileURL(path.resolve(entry)).href, { waitUntil: 'load', timeout: 30_000 });
  await ready(page, fixtureContext);
  await assertFixture(page, fixtureContext);

  await page.waitForTimeout(900);
  for (const watts of [438, 472, 517, 489, 451, 412, 376, 405]) {
    await page.evaluate(value => globalThis.__powerFixture.setValue('total', value), watts);
    await page.waitForTimeout(650);
  }

  const info = page.locator('#infoButton');
  if (await info.count()) {
    await info.click();
    await page.waitForTimeout(1200);
    const close = page.locator('#closeInfo');
    if (await close.count()) await close.click();
  }
  await page.waitForTimeout(800);

  report.final = await page.evaluate(() => ({
    panel: document.body.getAttribute('data-panel-state'),
    now: document.getElementById('nowValue')?.textContent?.trim() || '',
    average: document.getElementById('averageValue')?.textContent?.trim() || '',
    energy: document.getElementById('energyValue')?.textContent?.trim() || '',
    energyUnit: document.getElementById('energyUnit')?.textContent?.trim() || '',
    peak: document.getElementById('peakValue')?.textContent?.trim() || '',
    scope: document.getElementById('scopeLabel')?.textContent?.trim() || '',
    sensor: document.getElementById('sensorName')?.textContent?.trim() || '',
    graphSeries: document.querySelectorAll('#powerGraph path.series').length,
  }));
  if (report.final.panel !== 'ready') throw new Error(`meter not ready: ${JSON.stringify(report.final)}`);
  if (!report.final.scope.includes('TOTAL POWER DRAW') || !report.final.scope.includes('MEASURED')) throw new Error(`scope disclosure missing: ${JSON.stringify(report.final)}`);
  if (report.final.graphSeries < 1) throw new Error(`graph did not render: ${JSON.stringify(report.final)}`);
  if (errors.length) throw new Error(`page errors: ${JSON.stringify(errors)}`);
  report.passed = true;
} catch (error) {
  report.error = String(error?.stack || error);
  exitCode = 1;
} finally {
  report.pageErrors = errors;
  const video = page.video();
  await page.close();
  await context.close();
  if (video) {
    try {
      const recorded = await video.path();
      videoPath = path.join(outDir, 'pc-power-meter-review-demo.webm');
      if (path.resolve(recorded) !== path.resolve(videoPath)) fs.copyFileSync(recorded, videoPath);
      report.video = path.basename(videoPath);
    } catch (error) {
      report.video_error = String(error?.stack || error);
      if (!exitCode) exitCode = 1;
    }
  }
  fs.writeFileSync(path.join(outDir, 'README.txt'), report.disclosure + '\n', 'utf8');
  fs.writeFileSync(path.join(outDir, 'pc-power-review-demo-result.json'), JSON.stringify(report, null, 2) + '\n');
  await browser.close();
}

console.log(JSON.stringify(report, null, 2));
process.exit(exitCode);
