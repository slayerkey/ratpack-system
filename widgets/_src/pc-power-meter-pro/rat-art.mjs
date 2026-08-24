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
  { name: 'high-power', slot: 'M_H', mode: 'high' },
  { name: 'preview', slot: 'M_H', mode: 'preview' },
  { name: 'empty', slot: 'M_H', mode: 'empty' },
];

export async function prepare(page, context) {
  const fixtureSensors = structuredClone(baseSensors);
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

    try {
      localStorage.clear();
      if (mode !== 'preview' && mode !== 'empty') {
        const now = Date.now();
        localStorage.setItem('rat-art-power-pro:pc-power-meter-pro:session', JSON.stringify({
          sensorId: 'total', startedAt: now - 2 * 3600000, lastSeenAt: now - 1000,
          energyWh: mode === 'high' ? 25000 : 840, measuredMs: 7200000,
          peakW: mode === 'high' ? 12500 : 517, samples: 7200,
        }));
        const key = new Date(now).toLocaleDateString('en-CA');
        localStorage.setItem('rat-art-power-pro:pc-power-meter-pro:daily', JSON.stringify({ [key]: { wh: 1320, measuredMs: 10800000 } }));
        localStorage.setItem('rat-art-power-pro:pc-power-meter-pro:history', JSON.stringify([{
          sensorId: 'total', startedAt: now - 6 * 3600000, endedAt: now - 4 * 3600000,
          energyWh: 620, measuredMs: 7200000, averageW: 310, peakW: 461,
        }]));
      }
    } catch {}

    if (mode === 'preview') {
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
  }, { sensors: fixtureSensors, mode: context.variant?.mode || 'normal' });
}

export async function ready(page, context) {
  if (context.variant?.mode === 'empty') {
    await page.waitForFunction(() => document.body.getAttribute('data-panel-state') === 'empty', { timeout: 10000 });
    return;
  }
  await page.waitForFunction(() => document.body.getAttribute('data-panel-state') === 'ready', { timeout: 10000 });
  await page.waitForFunction(() => document.getElementById('nowValue')?.textContent?.trim() !== '—', { timeout: 5000 });
  if (context.variant?.mode === 'info') {
    await page.locator('#infoButton').click();
    await page.waitForFunction(() => !document.getElementById('infoOverlay')?.hidden);
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
    overlayHidden: document.getElementById('infoOverlay')?.hidden,
    primary: globalThis.PackRatPowerMeterTest?.getPrimary?.() || null,
    catalogue: globalThis.PackRatPowerMeterTest?.getCatalogue?.() || {},
  }));

  if (report.slot !== expectedSlot) throw new Error(`slot mismatch: ${JSON.stringify(report)}`);
  if (context.variant?.mode === 'empty') {
    if (report.panel !== 'empty') throw new Error(`empty Pro fixture failed: ${JSON.stringify(report)}`);
    return;
  }
  if (report.panel !== 'ready') throw new Error(`Pro fixture not ready: ${JSON.stringify(report)}`);
  if (context.variant?.mode === 'preview') {
    if (report.primary?.id !== 'preview-power') throw new Error(`preview mode did not use safe demo telemetry: ${JSON.stringify(report)}`);
    return;
  }
  if (report.primary?.id !== 'total') throw new Error(`wrong Pro primary sensor: ${JSON.stringify(report)}`);
  if (report.comparisons !== 2) throw new Error(`comparison sensors failed: ${JSON.stringify(report)}`);
  if (!String(report.catalogue['psu-a']?.displayName || '').endsWith('#1') || !String(report.catalogue['psu-b']?.displayName || '').endsWith('#2')) throw new Error('duplicate Pro sensor labels were not disambiguated');
  if (context.variant?.mode === 'high') {
    if (report.now !== '12,500' || report.threshold !== 'high') throw new Error(`high power threshold failed: ${JSON.stringify(report)}`);
  } else {
    if (!report.cost.startsWith('$0.126')) throw new Error(`cost calculation/render failed: ${JSON.stringify(report)}`);
    if (report.todayUnit !== 'kWh') throw new Error(`daily energy failed: ${JSON.stringify(report)}`);
    if (!report.history.includes('LAST SESSION') || !report.history.includes('620')) throw new Error(`history summary failed: ${JSON.stringify(report)}`);
  }
  if (context.variant?.mode === 'info' && report.overlayHidden) throw new Error('Pro info overlay did not open');
}
