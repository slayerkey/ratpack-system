const sensors = {
  'mouse-low': { type: 'battery-charge', device: 'SABRE RGB', name: 'Battery', units: '%', value: '9', connected: true },
  'mouse-low-status': { type: 'battery-status', device: 'SABRE RGB', name: 'Battery Status', units: '', value: 'Charging', connected: true },
  'headset': { type: 'battery-charge', device: 'VIRTUOSO MAX', name: 'Battery', units: '%', value: '18', connected: true },
  'headset-status': { type: 'battery-status', device: 'VIRTUOSO MAX', name: 'Battery Status', units: '', value: 'Discharging', connected: true },
  'keyboard': { type: 'battery-charge', device: 'K100 AIR', name: 'Battery', units: '%', value: '43', connected: true },
  'keyboard-status': { type: 'battery-status', device: 'K100 AIR', name: 'Battery Status', units: 'hours', value: '2.5', connected: true },
  'mouse-two': { type: 'battery-charge', device: 'SABRE RGB', name: 'Battery 2', units: '%', value: '65', connected: true },
  'mouse-two-status': { type: 'battery-status', device: 'SABRE RGB', name: 'Battery Status 2', units: '', value: 'Discharging', connected: true },
  'healthy': { type: 'battery-charge', device: 'DARK CORE', name: 'Battery', units: '%', value: '88', connected: true },
  'healthy-status': { type: 'battery-status', device: 'DARK CORE', name: 'Battery Status', units: '', value: 'Full', connected: true },
  'temp': { type: 'temperature', device: 'CPU', name: 'Package', units: 'C', value: '55', connected: true },
  'gone': { type: 'battery-charge', device: 'DISCONNECTED', name: 'Battery', units: '%', value: '3', connected: false },
};

export const variants = [
  { name: 'detail', slot: 'M_H', mode: 'detail' },
];

export async function prepare(page) {
  await page.addInitScript(({ fixtureSensors }) => {
    globalThis.uniqueId = 'rat-art-rig-battery';
    globalThis.lowBatteryThreshold = 20;
    globalThis.textColor = '#F4F6F8';
    globalThis.accentColor = '#2BE86A';
    globalThis.backgroundColor = '#070A0D';
    globalThis.tr = async value => value;
    try { localStorage.clear(); } catch {}

    class Signal {
      constructor() { this.listeners = []; }
      connect(fn) { this.listeners.push(fn); }
      emit(...args) { for (const fn of this.listeners) fn(...args); }
    }

    const asyncResponse = new Signal();
    const plugin = {
      asyncResponse,
      sensorAdded: new Signal(),
      sensorRemoved: new Signal(),
      sensorDataChanged: new Signal(),
      sensorValueChanged: new Signal(),
      sensorUnitsChanged: new Signal(),
      getAllSensorIds(id) { setTimeout(() => asyncResponse.emit(id, Object.keys(fixtureSensors)), 0); },
      getSensorType(id, sensorId) { setTimeout(() => asyncResponse.emit(id, fixtureSensors[sensorId]?.type ?? ''), 0); },
      getSensorDeviceName(id, sensorId) { setTimeout(() => asyncResponse.emit(id, fixtureSensors[sensorId]?.device ?? ''), 0); },
      getSensorName(id, sensorId) { setTimeout(() => asyncResponse.emit(id, fixtureSensors[sensorId]?.name ?? ''), 0); },
      getSensorUnits(id, sensorId) { setTimeout(() => asyncResponse.emit(id, fixtureSensors[sensorId]?.units ?? ''), 0); },
      getSensorValue(id, sensorId) { setTimeout(() => asyncResponse.emit(id, fixtureSensors[sensorId]?.value ?? ''), 0); },
      sensorIsConnected(id, sensorId) { setTimeout(() => asyncResponse.emit(id, fixtureSensors[sensorId]?.connected !== false), 0); },
    };

    globalThis.plugins = { Sensorsdataprovider: plugin };
    globalThis.pluginSensorsdataprovider_initialized = true;
  }, { fixtureSensors: sensors });
}

export async function ready(page, context) {
  await page.waitForFunction(
    () => document.body.getAttribute('data-panel-state') === 'ready',
    { timeout: 10000 },
  );

  if (context.variant?.mode === 'detail') {
    await page.locator('.battery-card').first().click();
    await page.waitForFunction(
      () => {
        const metric = document.querySelector('.battery-card .metric')?.textContent || '';
        return metric.includes('Charging');
      },
      { timeout: 3000 },
    );
  }
  await page.waitForTimeout(200);
}

export async function assert(page, context) {
  const expectedSlot = context.slot.toLowerCase().replace('_', '-');
  const report = await page.evaluate(() => {
    const visibleCards = Array.from(document.querySelectorAll('.battery-card')).filter(card => {
      const style = getComputedStyle(card);
      const rect = card.getBoundingClientRect();
      return style.display !== 'none' && rect.width > 0 && rect.height > 0;
    });
    return {
      slot: document.body.getAttribute('data-slot'),
      panel: document.body.getAttribute('data-panel-state'),
      names: Array.from(document.querySelectorAll('.device-name')).map(node => node.textContent?.trim()),
      charging: document.querySelectorAll('.battery-card.is-charging').length,
      low: document.querySelectorAll('.battery-card.is-low').length,
      visible: visibleCards.length,
      firstMetric: document.querySelector('.battery-card .metric')?.textContent?.trim() || '',
    };
  });

  if (report.panel !== 'ready') throw new Error(`Battery fixture not ready: ${JSON.stringify(report)}`);
  if (report.slot !== expectedSlot) throw new Error(`Battery slot mismatch: expected ${expectedSlot}, got ${report.slot}`);
  if (report.names[0] !== 'SABRE RGB 1') throw new Error(`Lowest battery is not first: ${JSON.stringify(report)}`);
  if (!report.names.includes('VIRTUOSO MAX') || !report.names.includes('K100 AIR') || report.names.includes('DISCONNECTED')) {
    throw new Error(`Battery device filtering mismatch: ${JSON.stringify(report)}`);
  }
  if (report.charging !== 1 || report.low !== 2) throw new Error(`Battery state count mismatch: ${JSON.stringify(report)}`);
  const expectedVisible = context.slot === 'S_H' || context.slot === 'S_V' ? 2 : 5;
  if (report.visible !== expectedVisible) throw new Error(`Battery visible card mismatch: ${JSON.stringify(report)}`);
  if (context.variant?.mode === 'detail' && !report.firstMetric.includes('Charging')) {
    throw new Error(`Battery detail variant did not render: ${JSON.stringify(report)}`);
  }
}
