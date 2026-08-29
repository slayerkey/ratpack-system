#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const entry = process.argv[2];
const outDir = path.resolve(process.argv[3] || 'artifacts/pc-power-sensor-init');
if (!entry || !fs.existsSync(entry)) {
  console.error('usage: node tools/xeneon/pc-power-sensor-init-smoke.mjs <exact-packaged-index.html> [output-dir]');
  process.exit(2);
}
fs.mkdirSync(outDir, { recursive: true });

const html = fs.readFileSync(entry, 'utf8');
if (!/Sensorsdataprovider/i.test(html)) {
  console.error('package does not reference the Sensors data provider');
  process.exit(2);
}

const harness = `<script id="ratpack-power-plugin-init-harness">
let powerSensor = 'total';
let textColor = '#F4F6F8';
let accentColor = '#2BE86A';
let graphColor = '#2BE86A';
let backgroundColor = '#070A0D';
let graphWindow = 60;
let iCUE_initialized = true;
let pluginSensorsdataprovider_initialized = false;
let uniqueId = 'ratpack-power-plugin-init';
globalThis.tr = async function (value) { return value; };
globalThis.iCUE = { isPreview: false };
globalThis.plugins = {};

class RatpackSignal {
  constructor() { this.listeners = []; }
  connect(fn) { this.listeners.push(fn); }
  emit(...args) { for (const fn of [...this.listeners]) fn(...args); }
}

globalThis.__installRatpackPowerSensorsPlugin = function () {
  const store = {
    total: { type: 'power', kind: 'total-power-draw', device: 'RMx SHIFT', name: 'Total Power Draw', units: 'W', value: '412', connected: true },
    temp: { type: 'temperature', kind: 'package', device: 'CPU', name: 'Package', units: 'C', value: '61', connected: true }
  };
  const asyncResponse = new RatpackSignal();
  const plugin = {
    asyncResponse,
    sensorAdded: new RatpackSignal(),
    sensorRemoved: new RatpackSignal(),
    sensorDataChanged: new RatpackSignal(),
    sensorValueChanged: new RatpackSignal(),
    sensorUnitsChanged: new RatpackSignal(),
    getAllSensorIds(id) { setTimeout(() => asyncResponse.emit(id, Object.keys(store)), 0); },
    getSensorType(id, sensorId) { setTimeout(() => asyncResponse.emit(id, store[sensorId]?.type ?? ''), 0); },
    getSensorKind(id, sensorId) { setTimeout(() => asyncResponse.emit(id, store[sensorId]?.kind ?? 'default'), 0); },
    getSensorDeviceName(id, sensorId) { setTimeout(() => asyncResponse.emit(id, store[sensorId]?.device ?? ''), 0); },
    getSensorName(id, sensorId) { setTimeout(() => asyncResponse.emit(id, store[sensorId]?.name ?? ''), 0); },
    getSensorUnits(id, sensorId) { setTimeout(() => asyncResponse.emit(id, store[sensorId]?.units ?? ''), 0); },
    getSensorValue(id, sensorId) { setTimeout(() => asyncResponse.emit(id, store[sensorId]?.value ?? null), 0); },
    sensorIsConnected(id, sensorId) { setTimeout(() => asyncResponse.emit(id, store[sensorId]?.connected !== false), 0); },
    getDefaultSensorId(id, type, preferredKind) {
      const ids = Object.keys(store);
      const exact = ids.find(key => store[key]?.connected !== false && store[key]?.type === type && store[key]?.kind === preferredKind);
      const typed = ids.find(key => store[key]?.connected !== false && store[key]?.type === type);
      setTimeout(() => asyncResponse.emit(id, exact || typed || ''), 0);
    },
    getDefaultSensorIdBlock() { return 'total'; }
  };
  globalThis.plugins.Sensorsdataprovider = plugin;
  pluginSensorsdataprovider_initialized = true;
};
</script>`;

if (!/<head(?:\s[^>]*)?>/i.test(html)) throw new Error('packaged widget is missing <head>');
const instrumented = html.replace(/<head(\s[^>]*)?>/i, match => match + '\n' + harness);
const instrumentedEntry = path.join(path.dirname(path.resolve(entry)), '__ratpack-power-plugin-init.html');
fs.writeFileSync(instrumentedEntry, instrumented, 'utf8');

const report = {
  schema_version: 1,
  entry: path.basename(entry),
  evidence_type: 'exact packaged widget with delayed Sensors plugin initialization',
  initial: null,
  updated: null,
  passed: false,
};

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1688, height: 696 } });
const pageErrors = [];
page.on('pageerror', error => pageErrors.push(String(error)));
let exitCode = 0;

try {
  await page.goto(pathToFileURL(instrumentedEntry).href, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => document.body.getAttribute('data-panel-state') === 'unavailable', null, { timeout: 5000 });
  report.initial = await page.evaluate(() => ({
    panel: document.body.getAttribute('data-panel-state'),
    pluginLifecycle: typeof globalThis.pluginSensorsdataproviderEvents?.onInitialized,
    icueLifecycle: typeof globalThis.icueEvents?.onDataUpdated,
    primary: globalThis.PackRatPowerMeterTest?.getPrimary?.() || null,
  }));
  if (report.initial.pluginLifecycle !== 'function') throw new Error(`Sensors plugin lifecycle missing: ${JSON.stringify(report.initial)}`);
  if (report.initial.icueLifecycle !== 'function') throw new Error(`iCUE update lifecycle missing: ${JSON.stringify(report.initial)}`);

  await page.evaluate(() => {
    globalThis.__installRatpackPowerSensorsPlugin();
    globalThis.pluginSensorsdataproviderEvents.onInitialized();
  });

  await page.waitForFunction(() => {
    const primary = globalThis.PackRatPowerMeterTest?.getPrimary?.();
    return document.body.getAttribute('data-panel-state') === 'ready'
      && primary?.id === 'total'
      && document.getElementById('nowValue')?.textContent?.trim() !== '—';
  }, null, { timeout: 7000 });

  report.updated = await page.evaluate(() => ({
    panel: document.body.getAttribute('data-panel-state'),
    now: document.getElementById('nowValue')?.textContent?.trim() || '',
    sensor: document.getElementById('sensorName')?.textContent?.trim() || '',
    scope: document.getElementById('scopeLabel')?.textContent?.trim() || '',
    primary: globalThis.PackRatPowerMeterTest?.getPrimary?.() || null,
    catalogue: globalThis.PackRatPowerMeterTest?.getCatalogue?.() || {},
  }));

  if (report.updated.primary?.id !== 'total') throw new Error(`power sensor was not discovered after plugin init: ${JSON.stringify(report.updated)}`);
  if (report.updated.catalogue?.temp) throw new Error(`non-power sensor leaked into power catalogue: ${JSON.stringify(report.updated.catalogue)}`);
  if (!report.updated.scope.includes('TOTAL POWER DRAW')) throw new Error(`power scope was not preserved: ${JSON.stringify(report.updated)}`);
  if (pageErrors.length) throw new Error(`page errors: ${JSON.stringify(pageErrors)}`);

  await page.screenshot({ path: path.join(outDir, 'pc-power-after-plugin-init.png'), fullPage: true });
  report.passed = true;
} catch (error) {
  report.error = String(error?.stack || error);
  exitCode = 1;
} finally {
  report.pageErrors = pageErrors;
  fs.writeFileSync(path.join(outDir, 'pc-power-sensor-init-result.json'), JSON.stringify(report, null, 2) + '\n');
  try { fs.unlinkSync(instrumentedEntry); } catch {}
  await browser.close();
}

console.log(JSON.stringify(report, null, 2));
process.exit(exitCode);
