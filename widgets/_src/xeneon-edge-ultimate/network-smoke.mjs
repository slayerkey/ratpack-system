import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const entry = process.argv[2];
const outDir = process.argv[3] || 'artifacts/xeneon-edge-ultimate-smoke';
if (!entry || !fs.existsSync(entry)) {
  console.error('usage: node network-smoke.mjs <packaged-index.html> [output-dir]');
  process.exit(2);
}
fs.mkdirSync(outDir, { recursive: true });

const SLOTS = [
  ['s-h', 840, 344], ['s-v', 696, 416], ['m-h', 840, 696], ['m-v', 696, 840],
  ['l-h', 1688, 696], ['l-v', 696, 1688], ['xl-h', 2536, 696], ['xl-v', 696, 2536],
];

const report = {
  schema_version: 1,
  entry: path.basename(entry),
  network: { observedRequests: 0, responses: [], text: null, state: null },
  providers: {},
  slots: [],
  runtimeErrors: [],
};

function initFixture() {
  globalThis.uniqueId = 'ultimate-package-smoke';
  globalThis.iCUE = { isPreview: false };
  globalThis.preset = 'everyday';
  globalThis.startMode = 'home';
  globalThis.smartMode = false;
  globalThis.use24Hour = true;
  globalThis.temperatureUnit = 'c';
  globalThis.weatherEnabled = false;
  globalThis.weatherLatitude = '';
  globalThis.weatherLongitude = '';
  globalThis.calendarUrl = '';
  globalThis.focusMinutes = 25;
  globalThis.pinnedNote = 'Smoke fixture';
  globalThis.graphWindow = '5m';
  globalThis.textColor = '#F5F7FA';
  globalThis.accentColor = '#2BE86A';
  globalThis.backgroundColor = '#07090D';
  globalThis.tr = async value => value;
  try { localStorage.clear(); } catch {}

  function signal() {
    const listeners = [];
    return { connect(fn) { listeners.push(fn); }, emit(id, value) { for (const fn of listeners) fn(id, value); } };
  }
  function makeAsync(methods) {
    const asyncResponse = signal();
    const obj = { asyncResponse };
    for (const [name, fn] of Object.entries(methods)) {
      obj[name] = (id, ...args) => setTimeout(() => asyncResponse.emit(id, fn(...args)), 0);
    }
    return obj;
  }
  const sensorValues = {
    'gpu-temp': 67, 'gpu-load': 78, 'cpu-temp': 59, 'cpu-load': 43,
  };
  const sensorMeta = {
    'gpu-temp': ['NVIDIA GeForce RTX', 'GPU Temperature', '°C', 'temperature', 'gpu'],
    'gpu-load': ['NVIDIA GeForce RTX', 'GPU Load', '%', 'load', 'gpu'],
    'cpu-temp': ['CPU', 'CPU Package Temperature', '°C', 'temperature', 'package'],
    'cpu-load': ['CPU', 'CPU Total Load', '%', 'load', 'cpu'],
  };
  const sensors = makeAsync({
    getAllSensorIds: () => Object.keys(sensorValues),
    getSensorDeviceName: id => sensorMeta[id]?.[0] || '',
    getSensorName: id => sensorMeta[id]?.[1] || '',
    getSensorUnits: id => sensorMeta[id]?.[2] || '',
    getSensorType: id => sensorMeta[id]?.[3] || '',
    getSensorKind: id => sensorMeta[id]?.[4] || '',
    getSensorValue: id => sensorValues[id] ?? null,
  });
  const fps = makeAsync({
    getFpsAvailable: () => true,
    getCurrentFps: () => 237,
    getCurrentProcess: () => 'SmokeGame.exe',
  });
  const media = makeAsync({
    getSongName: () => 'Midnight Circuit',
    getArtist: () => 'Velvet Static',
  });
  media.triggerPreviousTrack = () => {};
  media.triggerPlayPause = () => {};
  media.triggerNextTrack = () => {};
  globalThis.plugins = {
    Sensorsdataprovider: sensors,
    Fpsdataprovider: fps,
    Mediadataprovider: media,
  };
}

const browser = await chromium.launch({ headless: true });
let exitCode = 0;
try {
  for (let index = 0; index < SLOTS.length; index += 1) {
    const [slot, width, height] = SLOTS[index];
    const context = await browser.newContext({ viewport: { width, height } });
    await context.addInitScript(initFixture);
    const page = await context.newPage();
    const localErrors = [];
    page.on('pageerror', error => localErrors.push(`pageerror: ${String(error)}`));
    page.on('console', message => { if (message.type() === 'error') localErrors.push(`console: ${message.text()}`); });
    page.on('request', request => {
      if (request.url().includes('www.cloudflare.com/cdn-cgi/trace')) report.network.observedRequests += 1;
    });
    page.on('response', response => {
      if (response.url().includes('www.cloudflare.com/cdn-cgi/trace')) {
        report.network.responses.push({ status: response.status(), url: response.url() });
      }
    });

    await page.goto(pathToFileURL(path.resolve(entry)).href, { waitUntil: 'load', timeout: 30_000 });
    await page.waitForFunction(() => document.body?.getAttribute('data-slot'), { timeout: 5000 });
    await page.waitForFunction(() => document.getElementById('gpuTemp')?.textContent?.trim() !== '—', { timeout: 8000 });
    await page.waitForFunction(() => document.getElementById('fpsValue')?.textContent?.trim() !== '—', { timeout: 8000 });

    if (index === 0) {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        await page.evaluate(async () => { if (typeof probeNetwork === 'function') await probeNetwork(); });
        await page.waitForTimeout(1000);
        const text = (await page.locator('#networkText').textContent().catch(() => ''))?.trim() || '';
        if (/\b\d+\s*ms\b/i.test(text)) break;
      }
      report.network.text = (await page.locator('#networkText').textContent().catch(() => null))?.trim() || null;
      report.network.state = await page.evaluate(() => globalThis.state?.network?.state || null);
      report.providers = await page.evaluate(() => ({
        gpuTemp: document.getElementById('gpuTemp')?.textContent?.trim(),
        cpuTemp: document.getElementById('cpuTemp')?.textContent?.trim(),
        gpuLoad: document.getElementById('gpuLoad')?.textContent?.trim(),
        fps: document.getElementById('fpsValue')?.textContent?.trim(),
        mediaTitle: globalThis.state?.media?.title || '',
      }));
    }

    const geometry = await page.evaluate(() => {
      const doc = document.documentElement;
      const body = document.body;
      const visibleScreens = [...document.querySelectorAll('.screen')].filter(el => getComputedStyle(el).opacity !== '0');
      const touch = [...document.querySelectorAll('button')].filter(el => {
        const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden';
      }).map(el => {
        const r = el.getBoundingClientRect();
        return { id: el.id || el.getAttribute('data-mode-target') || el.className, w: r.width, h: r.height };
      });
      return {
        slot: body.getAttribute('data-slot'),
        scrollWidth: doc.scrollWidth,
        scrollHeight: doc.scrollHeight,
        innerWidth,
        innerHeight,
        visibleScreenCount: visibleScreens.length,
        tinyTouchTargets: touch.filter(x => x.w < 34 || x.h < 30).slice(0, 12),
      };
    });

    const slotResult = { requested: slot, geometry, runtimeErrors: localErrors };
    report.slots.push(slotResult);
    report.runtimeErrors.push(...localErrors.map(error => `${slot}: ${error}`));
    if (geometry.slot !== slot) throw new Error(`${slot}: nearest-slot mismatch: ${geometry.slot}`);
    if (geometry.scrollWidth > width + 1 || geometry.scrollHeight > height + 1) {
      throw new Error(`${slot}: document overflow ${geometry.scrollWidth}x${geometry.scrollHeight} > ${width}x${height}`);
    }
    if (geometry.visibleScreenCount !== 1) throw new Error(`${slot}: expected one visible screen, got ${geometry.visibleScreenCount}`);
    if (geometry.tinyTouchTargets.length) throw new Error(`${slot}: tiny touch targets ${JSON.stringify(geometry.tinyTouchTargets)}`);
    if (localErrors.length) throw new Error(`${slot}: runtime errors ${JSON.stringify(localErrors)}`);

    if (['l-h', 'xl-h'].includes(slot)) {
      await page.screenshot({ path: path.join(outDir, `${slot}.png`) });
    }
    await context.close();
  }

  if (!/\b\d+\s*ms\b/i.test(String(report.network.text || ''))) {
    throw new Error(`live HTTPS response timing did not produce a reading: ${JSON.stringify(report.network)}`);
  }
  if (report.network.observedRequests < 1) throw new Error('Cloudflare HTTPS probe request was not observed');
  if (report.providers.fps !== '237' || report.providers.gpuTemp !== '67' || report.providers.gpuLoad !== '78') {
    throw new Error(`native provider fixture did not render expected values: ${JSON.stringify(report.providers)}`);
  }
} catch (error) {
  report.error = String(error?.stack || error);
  exitCode = 1;
} finally {
  fs.writeFileSync(path.join(outDir, 'smoke-result.json'), JSON.stringify(report, null, 2) + '\n');
  await browser.close();
}

console.log(JSON.stringify(report, null, 2));
process.exit(exitCode);
