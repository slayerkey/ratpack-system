const baseSensors = {
  total: { type: 'power', kind: 'total-power-draw', device: 'RMx SHIFT', name: 'Total Power Draw', units: 'W', value: '412', connected: true },
  cpu: { type: 'power', kind: 'package', device: 'AMD Ryzen 9', name: 'Package Power', units: 'W', value: '128', connected: true },
  gpu: { type: 'power', kind: 'default', device: 'GeForce RTX', name: 'GPU Power', units: 'W', value: '244', connected: true },
  'dup-a': { type: 'power', kind: 'power-out', device: 'HX1500i', name: 'Power', units: 'W', value: '390', connected: true },
  'dup-b': { type: 'power', kind: 'power-out', device: 'HX1500i', name: 'Power', units: 'W', value: '388', connected: true },
  temp: { type: 'temperature', kind: 'package', device: 'CPU', name: 'Package', units: 'C', value: '62', connected: true },
  gone: { type: 'power', kind: 'default', device: 'Disconnected GPU', name: 'Power', units: 'W', value: '999', connected: false },
};

export const variants = [
  { name: 'info', slot: 'M_H', mode: 'info' },
  { name: 'zero', slot: 'S_H', mode: 'zero' },
  { name: 'high-power', slot: 'M_H', mode: 'high' },
  { name: 'empty', slot: 'M_H', mode: 'empty' },
];

export async function prepare(page, context) {
  const fixtureSensors = structuredClone(baseSensors);
  if (context.variant?.mode === 'zero') fixtureSensors.total.value = '0';
  if (context.variant?.mode === 'high') fixtureSensors.total.value = '12500';
  if (context.variant?.mode === 'empty') {
    for (const key of Object.keys(fixtureSensors)) {
      if (fixtureSensors[key].type === 'power') delete fixtureSensors[key];
    }
  }

  await page.addInitScript(({ sensors, mode }) => {
    globalThis.uniqueId = 'rat-art-power';
    globalThis.powerSensor = mode === 'empty' ? '' : 'total';
    globalThis.textColor = '#F4F6F8';
    globalThis.accentColor = '#2BE86A';
    globalThis.graphColor = '#2BE86A';
    globalThis.backgroundColor = '#070A0D';
    globalThis.tr = async value => value;
    globalThis.iCUE = { isPreview: false };
    globalThis.pluginLinkprovider_initialized = true;
    globalThis.__fixtureErrors = [];
    addEventListener('error', event => globalThis.__fixtureErrors.push(`error:${event.message || event.error || 'unknown'}`));
    addEventListener('unhandledrejection', event => globalThis.__fixtureErrors.push(`rejection:${String(event.reason || 'unknown')}`));

    try {
      localStorage.clear();
      if (mode !== 'empty') {
        const now = Date.now();
        const isZero = mode === 'zero';
        const isHigh = mode === 'high';
        localStorage.setItem('rat-art-power:pc-power-meter:session', JSON.stringify({
          sensorId: 'total', startedAt: now - 2 * 3600000, lastSeenAt: now - 1000,
          energyWh: isZero ? 0 : (isHigh ? 25000 : 840), measuredMs: isZero ? 0 : 7200000,
          peakW: isZero ? 0 : (isHigh ? 12500 : 517), samples: isZero ? 1 : 7200,
        }));
      }
    } catch {}

    class Signal {
      constructor() { this.listeners = []; }
      connect(fn) { this.listeners.push(fn); }
      emit(...args) { for (const fn of [...this.listeners]) fn(...args); }
    }

    const store = sensors;
    const asyncResponse = new Signal();
    const plugin = {
      asyncResponse,
      sensorAdded: new Signal(), sensorRemoved: new Signal(), sensorDataChanged: new Signal(),
      sensorValueChanged: new Signal(), sensorUnitsChanged: new Signal(),
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
      getDefaultSensorIdBlock() { return 'total'; },
    };

    globalThis.plugins = { Sensorsdataprovider: plugin, Linkprovider: { open(url) { globalThis.__openedMarketplaceUrl = url; } } };
    globalThis.pluginSensorsdataprovider_initialized = true;
    globalThis.__powerFixture = {
      remove(id) { if (!store[id]) return; delete store[id]; plugin.sensorRemoved.emit(id); },
      add(id, sensor) { store[id] = sensor; plugin.sensorAdded.emit(id); },
      setValue(id, value) { if (!store[id]) return; store[id].value = String(value); plugin.sensorValueChanged.emit(id, String(value)); },
      totalSensor: { type: 'power', kind: 'total-power-draw', device: 'RMx SHIFT', name: 'Total Power Draw', units: 'W', value: '412', connected: true },
    };
  }, { sensors: fixtureSensors, mode: context.variant?.mode || 'normal' });
}

async function waitForPanel(page, expected) {
  try {
    await page.waitForFunction(state => document.body.getAttribute('data-panel-state') === state, expected, { timeout: 10000 });
  } catch (error) {
    const report = await page.evaluate(() => ({
      panel: document.body.getAttribute('data-panel-state'),
      stateTitle: document.getElementById('stateTitle')?.textContent?.trim() || '',
      stateBody: document.getElementById('stateBody')?.textContent?.trim() || '',
      errors: globalThis.__fixtureErrors || [],
      primary: globalThis.PackRatPowerMeterTest?.getPrimary?.() || null,
      catalogue: globalThis.PackRatPowerMeterTest?.getCatalogue?.() || {},
      powerSensor: typeof globalThis.powerSensor === 'string' ? globalThis.powerSensor : typeof globalThis.powerSensor,
    }));
    throw new Error(`power fixture failed waiting for ${expected}: ${JSON.stringify(report)} :: ${error.message}`);
  }
}

export async function ready(page, context) {
  if (context.variant?.mode === 'empty') { await waitForPanel(page, 'empty'); return; }
  await waitForPanel(page, 'ready');
  await page.waitForFunction(() => document.getElementById('nowValue')?.textContent?.trim() !== '—', null, { timeout: 5000 });
  if (context.variant?.mode === 'info') {
    await page.locator('#infoButton').click();
    await page.waitForFunction(() => !document.getElementById('infoOverlay')?.hidden, null, { timeout: 3000 });
  }
  await page.waitForTimeout(120);
}

export async function assert(page, context) {
  const expectedSlot = context.slot.toLowerCase().replace('_', '-');
  const report = await page.evaluate(() => ({
    slot: document.body.getAttribute('data-slot'), panel: document.body.getAttribute('data-panel-state'),
    now: document.getElementById('nowValue')?.textContent?.trim() || '',
    energy: document.getElementById('energyValue')?.textContent?.trim() || '',
    energyUnit: document.getElementById('energyUnit')?.textContent?.trim() || '',
    scope: document.getElementById('scopeLabel')?.textContent?.trim() || '',
    overlayHidden: document.getElementById('infoOverlay')?.hidden,
    catalogue: globalThis.PackRatPowerMeterTest?.getCatalogue?.() || {},
  }));
  if (report.slot !== expectedSlot) throw new Error(`slot mismatch: ${JSON.stringify(report)}`);
  if (context.variant?.mode === 'empty') { if (report.panel !== 'empty') throw new Error(`empty fixture did not render empty state: ${JSON.stringify(report)}`); return; }
  if (report.panel !== 'ready') throw new Error(`power fixture not ready: ${JSON.stringify(report)}`);
  if (!report.scope.includes('TOTAL POWER DRAW') || !report.scope.includes('MEASURED')) throw new Error(`scope is not explicit: ${JSON.stringify(report)}`);
  if (!String(report.catalogue['dup-a']?.displayName || '').endsWith('#1') || !String(report.catalogue['dup-b']?.displayName || '').endsWith('#2')) throw new Error(`duplicate power sensor labels were not disambiguated: ${JSON.stringify(report.catalogue)}`);
  if (context.variant?.mode === 'zero' && report.now !== '0.00') throw new Error(`zero reading failed: ${JSON.stringify(report)}`);
  if (context.variant?.mode === 'high' && report.now !== '12,500') throw new Error(`high power reading failed: ${JSON.stringify(report)}`);
  if (context.variant?.mode === 'info' && report.overlayHidden) throw new Error('info overlay did not open');
  if (!context.variant && !['Wh', 'kWh'].includes(report.energyUnit)) throw new Error(`energy unit failed: ${JSON.stringify(report)}`);
  if (!context.variant && context.slot === 'M_H') {
    const before = await page.evaluate(() => globalThis.PackRatPowerMeterTest.getSession());
    await page.evaluate(() => globalThis.__powerFixture.remove('total'));
    await page.waitForFunction(() => document.body.getAttribute('data-panel-state') === 'disconnected', null, { timeout: 3000 });
    await page.evaluate(() => globalThis.__powerFixture.add('total', globalThis.__powerFixture.totalSensor));
    await page.waitForFunction(() => document.body.getAttribute('data-panel-state') === 'ready' && globalThis.PackRatPowerMeterTest.getPrimary()?.id === 'total', null, { timeout: 3000 });
    const after = await page.evaluate(() => globalThis.PackRatPowerMeterTest.getSession());
    if (after.sensorId !== 'total' || after.energyWh + 1e-9 < before.energyWh) throw new Error(`reconnect corrupted session: ${JSON.stringify({ before, after })}`);
  }
}
