import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const entry = process.argv[2];
const outDir = process.argv[3] || 'artifacts/network-smoke';
if (!entry || !fs.existsSync(entry)) {
  console.error('usage: node network-smoke.mjs <packaged-index.html> [output-dir]');
  process.exit(2);
}
fs.mkdirSync(outDir, { recursive: true });

const probeUrl = 'https://speed.cloudflare.com/__down?bytes=1';
const report = {
  schema_version: 1,
  entry: path.basename(entry),
  liveProbe: {
    url: probeUrl,
    status: null,
    allowOrigin: null,
    observed: false,
  },
  windowBefore: null,
  windowAfter: null,
  speed: { down: null, up: null },
  uploadBytes: null,
  uploadContentType: null,
  runtimeErrors: [],
};

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1688, height: 696 } });
await context.addInitScript(({ probe }) => {
  globalThis.uniqueId = 'network-smoke-net-dashboard';
  globalThis.probeHosts = probe;
  globalThis.probeInterval = 60;
  globalThis.warnAt = 100;
  globalThis.textColor = '#F4F6F8';
  globalThis.accentColor = '#2BE86A';
  globalThis.backgroundColor = '#07090D';
  globalThis.tr = async value => value;
  try { localStorage.clear(); } catch {}
}, { probe: probeUrl });

const page = await context.newPage();
page.on('pageerror', error => report.runtimeErrors.push(`pageerror: ${String(error)}`));
page.on('console', message => {
  if (message.type() === 'error') report.runtimeErrors.push(`console: ${message.text()}`);
});

await page.route('https://speed.cloudflare.com/**', async route => {
  const request = route.request();
  const url = new URL(request.url());
  const bytes = Number(url.searchParams.get('bytes') || 0);
  const isWidgetProbe = url.pathname === '/__down' && bytes === 1 && url.searchParams.has('_packrat_probe');

  if (isWidgetProbe) {
    await route.continue();
    return;
  }

  if (url.pathname === '/__down') {
    const bodyBytes = bytes > 0 ? bytes : 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/octet-stream',
      body: Buffer.alloc(bodyBytes),
    });
    return;
  }

  if (url.pathname === '/__up') {
    const body = request.postDataBuffer();
    report.uploadBytes = body ? body.length : 0;
    report.uploadContentType = request.headers()['content-type'] || null;
    await route.fulfill({ status: 200, contentType: 'text/plain', body: 'ok' });
    return;
  }

  await route.continue();
});

page.on('response', async response => {
  const url = new URL(response.url());
  if (url.hostname !== 'speed.cloudflare.com' || url.pathname !== '/__down') return;
  if (Number(url.searchParams.get('bytes')) !== 1 || !url.searchParams.has('_packrat_probe')) return;
  report.liveProbe.observed = true;
  report.liveProbe.status = response.status();
  const headers = response.headers();
  report.liveProbe.allowOrigin = headers['access-control-allow-origin'] || null;
});

let exitCode = 0;
try {
  await page.goto(pathToFileURL(path.resolve(entry)).href, { waitUntil: 'load', timeout: 30_000 });

  await page.waitForFunction(
    () => document.getElementById('pingValue')?.textContent?.trim() !== '--',
    { timeout: 12_000 },
  ).catch(() => {});

  let ping = (await page.locator('#pingValue').textContent().catch(() => '--'))?.trim() || '--';
  for (let attempt = 0; attempt < 2 && ping === '--'; attempt += 1) {
    await page.evaluate(async () => {
      if (typeof runProbeCycle === 'function') await runProbeCycle(true);
    });
    await page.waitForTimeout(1200);
    ping = (await page.locator('#pingValue').textContent().catch(() => '--'))?.trim() || '--';
  }

  if (ping === '--') throw new Error('packaged widget could not complete a live Cloudflare HTTPS probe from file origin');
  if (!report.liveProbe.observed || report.liveProbe.status !== 200) {
    throw new Error(`live Cloudflare probe was not observed as HTTP 200: ${JSON.stringify(report.liveProbe)}`);
  }
  if (report.liveProbe.allowOrigin !== '*') {
    throw new Error(`Cloudflare live probe did not expose Access-Control-Allow-Origin: *: ${JSON.stringify(report.liveProbe)}`);
  }

  report.windowBefore = (await page.locator('#windowBadge').textContent())?.trim() || null;
  await page.locator('#ribbonPanel').click();
  await page.waitForFunction(
    before => document.getElementById('windowBadge')?.textContent?.trim() !== before,
    report.windowBefore,
    { timeout: 3000 },
  );
  report.windowAfter = (await page.locator('#windowBadge').textContent())?.trim() || null;
  if (report.windowBefore !== '30 MIN' || report.windowAfter !== '120 MIN') {
    throw new Error(`window interaction mismatch: ${report.windowBefore} -> ${report.windowAfter}`);
  }

  await page.locator('#speedPanel').click();
  await page.waitForFunction(() => document.body.classList.contains('speed-running'), { timeout: 3000 });
  await page.waitForFunction(
    () => !document.body.classList.contains('speed-running') &&
      document.getElementById('downValue')?.textContent?.trim() !== '--' &&
      document.getElementById('upValue')?.textContent?.trim() !== '--',
    { timeout: 45_000 },
  );

  report.speed.down = (await page.locator('#downValue').textContent())?.trim() || null;
  report.speed.up = (await page.locator('#upValue').textContent())?.trim() || null;
  if (report.uploadBytes !== 25_000_000) throw new Error(`upload body size mismatch: ${report.uploadBytes}`);
  if (!String(report.uploadContentType || '').toLowerCase().startsWith('text/plain')) {
    throw new Error(`upload content type is not CORS safelisted text/plain: ${report.uploadContentType}`);
  }
  if (report.runtimeErrors.length) throw new Error(`runtime errors: ${JSON.stringify(report.runtimeErrors)}`);

  await page.screenshot({ path: path.join(outDir, 'network-smoke.png') });
} catch (error) {
  report.error = String(error?.stack || error);
  exitCode = 1;
} finally {
  fs.writeFileSync(
    path.join(outDir, 'network-smoke-result.json'),
    JSON.stringify(report, null, 2) + '\n',
  );
  await browser.close();
}

console.log(JSON.stringify(report, null, 2));
process.exit(exitCode);
