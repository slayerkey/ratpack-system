const baseSensors = {
  total: { type: 'power', kind: 'total-power-draw', device: 'RMx SHIFT', name: 'Total Power Draw', units: 'W', value: '412', connected: true },
  cpu: { type: 'power', kind: 'package', device: 'AMD Ryzen 9', name: 'Package Power', units: 'W', value: '128', connected: true },
  gpu: { type: 'power', kind: 'default', device: 'GeForce RTX', name: 'GPU Power', units: 'W', value: '244', connected: true },
  'psu-a': { type: 'power', kind: 'power-out', device: 'HX1500i', name: 'Power', units: 'W', value: '389', connected: true },
  'psu-b': { type: 'power', kind: 'power-out', device: 'HX1500i', name: 'Power', units: 'W', value: '387', connected: true },
  temp: { type: 'temperature', kind: 'package', device: 'CPU', name: 'Package', units: 'C', value: '63', connected: true },
};

export const variants = [
  { name: 'info', slot: 'M_H', mode: 'info' },
  { name: 'zero', slot: 'S_H', mode: 'zero' },
  { name: 'high-power', slot: 'M_H', mode: 'high' },
  { name: 'preview', slot: 'M_H', mode: 'preview' },
  { name: 'empty', slot: 'M_H', mode: 'empty' },
  { name: 'unavailable', slot: 'M_H', mode: 'unavailable' },
];

export async function prepare(page, context) {
  const fixtureSensors = structuredClone(baseSensors);
  if (context.variant?.mode === 'zero') fixtureSensors.total.value = '0';
  if (context.variant?.mode === 'high') fixtureSensors.total.value = '12500';
  if (context.variant?.mode === 'empty') {
    for (const key of Object.keys(fixtureSensors)) if (fixtureSensors[key].type === 'power') delete fixtureSensors[key];
  }

  await page.addInitScript(({ sensors, mode }) => {
    globalThis.uniqueId = 'rat-art-power-pro';
    globalThis.primarySensor = mode === 'empty' ? '' : 'total';
    globalThis.comparisonSensors = [{ sensorId: 'cpu', color: '#78A9FF' }, { sensorId: 'gpu', color: '#D99BFF' }];
    globalThis.electricityRate = 0.15;
    globalThis.currencySymbol = '$';
    globalThis.graphWindow = '180';
    globalThis.highPowerThreshold = 500;
    globalThis.textColor = '#F4F6F8';
    globalThis.accentColor = '#2BE86A';
    globalThis.graphColor = '#2BE86A';
    globalThis.backgroundColor = '#070A0D';
    globalThis.tr = async value => value;
    globalThis.iCUE = { isPreview: mode === 'preview' };
    globalThis.__fixtureErrors = [];
    addEventListener('error', event => globalThis.__fixtureErrors.push(`error:${event.message || event.error || 'unknown'}`));
    addEventListener('unhandledrejection', event => globalThis.__fixtureErrors.push(`rejection:${String(event.reason || 'unknown')}`));

    try {
      localStorage.clear();
      if (!['preview', 'empty', 'unavailable'].includes(mode)) {
        const now = Date.now();
        const isZero = mode === 'zero';
        localStorage.setItem('rat-art-power-pro:pc-power-meter-pro:session', JSON.stringify({
          sensorId: 'total', startedAt: now - 2 * 3600000, lastSeenAt: now - 1000,
          energyWh: isZero ? 0 : (mode === 'high' ? 25000 : 840),
          measuredMs: isZero ? 0 : 7200000,
          peakW: isZero ? 0 : (mode === 'high' ? 12500 : 517),
          samples: isZero ? 1 : 7200,
        }));
        const d = new Date(now);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        localStorage.setItem('rat-art-power-pro:pc-power-meter-pro:daily', JSON.stringify({ [key]: { wh: isZero ? 0 : 1320, measuredMs: isZero ? 0 : 10800000 } }));
        localStorage.setItem('rat-art-power-pro:pc-power-meter-pro:history', JSON.stringify([{
          sensorId: 'total', startedAt: now - 6 * 3600000, endedAt: now - 4 * 3600000,
          energyWh: 620, measuredMs: 7200000, averageW: 310, peakW: 461,
        }]));
      }
    } catch {}

    if (mode === 'preview' || mode === 'unavailable') {
      globalThis.plugins = {};
      return;
    }

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
        const exact = ids.find(key => store[key]?.type === type && store[key]?.kind === preferredKind);
        const typed = ids.find(key => store[key]?.type === type);
        setTimeout(() => asyncResponse.emit(id, exact || typed || ''), 0);
      },
      getDefaultSensorIdBlock() { return 'total'; },
    };
    globalThis.plugins = { Sensorsdataprovider: plugin };
    globalThis.pluginSensorsdataprovider_initialized = true;
    globalThis.__powerProFixture = {
      setValue(id, value) {
        if (!store[id]) return;
        store[id].value = String(value);
        plugin.sensorValueChanged.emit(id, String(value));
      },
      remove(id) {
        if (!store[id]) return;
        delete store[id];
        plugin.sensorRemoved.emit(id);
      },
      add(id, sensor) {
        store[id] = sensor;
        plugin.sensorAdded.emit(id);
      },
      totalSensor: structuredClone(store.total),
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
      primarySensor: typeof globalThis.primarySensor === 'string' ? globalThis.primarySensor : typeof globalThis.primarySensor,
    }));
    throw new Error(`Pro power fixture failed waiting for ${expected}: ${JSON.stringify(report)} :: ${error.message}`);
  }
}

async function seedBaseGraph(page) {
  const traces = {
    total: [330, 360, 410, 385, 455, 517, 470, 430, 412],
    cpu: [80, 95, 120, 105, 135, 160, 145, 132, 128],
    gpu: [170, 190, 220, 205, 250, 285, 270, 255, 244],
  };
  await page.evaluate(series => {
    const originalNow = Date.now;
    const base = originalNow();
    try {
      const count = series.total.length;
      for (let index = 0; index < count; index += 1) {
        Date.now = () => base - (count - 1 - index) * 18000;
        globalThis.__powerProFixture.setValue('total', series.total[index]);
        globalThis.__powerProFixture.setValue('cpu', series.cpu[index]);
        globalThis.__powerProFixture.setValue('gpu', series.gpu[index]);
      }
    } finally {
      Date.now = originalNow;
    }
  }, traces);
  await page.waitForTimeout(80);
}

export async function ready(page, context) {
  if (context.variant?.mode === 'empty') { await waitForPanel(page, 'empty'); return; }
  if (context.variant?.mode === 'unavailable') { await waitForPanel(page, 'unavailable'); return; }
  await waitForPanel(page, 'ready');
  await page.waitForFunction(() => document.getElementById('nowValue')?.textContent?.trim() !== '—', null, { timeout: 5000 });
  if (!context.variant) await seedBaseGraph(page);
  if (context.variant?.mode === 'info') {
    await page.locator('#infoButton').click();
    await page.waitForFunction(() => !document.getElementById('infoOverlay')?.hidden, null, { timeout: 3000 });
  }
  await page.waitForTimeout(150);
}

export async function assert(page, context) {
  const expectedSlot = context.slot.toLowerCase().replace('_', '-');
  const report = await page.evaluate(() => ({
    slot: document.body.getAttribute('data-slot'),
    panel: document.body.getAttribute('data-panel-state'),
    threshold: document.body.getAttribute('data-threshold'),
    now: document.getElementById('nowValue')?.textContent?.trim() || '',
    cost: document.getElementById('costValue')?.textContent?.trim() || '',
    today: document.getElementById('todayValue')?.textContent?.trim() || '',
    todayUnit: document.getElementById('todayUnit')?.textContent?.trim() || '',
    history: document.getElementById('historySummary')?.textContent?.trim() || '',
    comparisons: document.querySelectorAll('.comparison-card').length,
    graphPaths: document.querySelectorAll('#powerGraph path.series').length,
    overlayHidden: document.getElementById('infoOverlay')?.hidden,
    primary: globalThis.PackRatPowerMeterTest?.getPrimary?.() || null,
    catalogue: globalThis.PackRatPowerMeterTest?.getCatalogue?.() || {},
  }));

  if (report.slot !== expectedSlot) throw new Error(`slot mismatch: ${JSON.stringify(report)}`);
  if (context.variant?.mode === 'empty') {
    if (report.panel !== 'empty') throw new Error(`empty Pro fixture failed: ${JSON.stringify(report)}`);
    return;
  }
  if (context.variant?.mode === 'unavailable') {
    if (report.panel !== 'unavailable') throw new Error(`unavailable Pro fixture failed: ${JSON.stringify(report)}`);
    return;
  }
  if (report.panel !== 'ready') throw new Error(`Pro fixture not ready: ${JSON.stringify(report)}`);
  if (context.variant?.mode === 'preview') {
    if (report.primary?.id !== 'preview-power' || report.now === '—') throw new Error(`preview mode did not use safe demo telemetry: ${JSON.stringify(report)}`);
    return;
  }
  if (report.primary?.id !== 'total') throw new Error(`wrong Pro primary sensor: ${JSON.stringify(report)}`);
  if (report.comparisons !== 2) throw new Error(`comparison sensors failed: ${JSON.stringify(report)}`);
  if (!String(report.catalogue['psu-a']?.displayName || '').endsWith('#1') || !String(report.catalogue['psu-b']?.displayName || '').endsWith('#2')) throw new Error('duplicate Pro sensor labels were not disambiguated');
  if (!context.variant && report.graphPaths !== 3) throw new Error(`Pro graph did not render all three measured traces: ${JSON.stringify(report)}`);
  if (context.variant?.mode === 'zero') {
    if (report.now !== '0.00' || report.cost !== '$0.000') throw new Error(`zero power/cost failed: ${JSON.stringify(report)}`);
  } else if (context.variant?.mode === 'high') {
    if (report.now !== '12,500' || report.threshold !== 'high') throw new Error(`high power threshold failed: ${JSON.stringify(report)}`);
  } else {
    if (!report.cost.startsWith('$0.126')) throw new Error(`cost calculation/render failed: ${JSON.stringify(report)}`);
    if (report.todayUnit !== 'kWh') throw new Error(`daily energy failed: ${JSON.stringify(report)}`);
    if (!report.history.includes('LAST SESSION') || !report.history.includes('620')) throw new Error(`history summary failed: ${JSON.stringify(report)}`);
  }
  if (context.variant?.mode === 'info' && report.overlayHidden) throw new Error('Pro info overlay did not open');

  if (!context.variant && context.slot === 'M_H') {
    const before = await page.evaluate(() => globalThis.PackRatPowerMeterTest.getSession());
    await page.evaluate(() => globalThis.__powerProFixture.remove('total'));
    await page.waitForFunction(() => document.body.getAttribute('data-panel-state') === 'disconnected', null, { timeout: 3000 });
    await page.evaluate(() => globalThis.__powerProFixture.add('total', globalThis.__powerProFixture.totalSensor));
    await page.waitForFunction(() => document.body.getAttribute('data-panel-state') === 'ready' && globalThis.PackRatPowerMeterTest.getPrimary()?.id === 'total', null, { timeout: 3000 });
    const after = await page.evaluate(() => globalThis.PackRatPowerMeterTest.getSession());
    if (after.sensorId !== 'total' || after.energyWh + 1e-9 < before.energyWh) throw new Error(`Pro reconnect corrupted the primary session: ${JSON.stringify({ before, after })}`);
  }
}
