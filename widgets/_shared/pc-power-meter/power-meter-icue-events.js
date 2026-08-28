/* PackRat PC Power Meter iCUE host lifecycle. Shipping builds inline this file. */
var icueEvents;
var pluginSensorsdataproviderEvents;

(function () {
  'use strict';

  function read(name, fallback) {
    try {
      if (typeof globalThis.__ratpackIcueRead === 'function') {
        var direct = globalThis.__ratpackIcueRead(name);
        if (direct !== undefined && direct !== null) return direct;
      }
      var value = globalThis[name];
      return value === undefined || value === null ? fallback : value;
    } catch (error) {
      return fallback;
    }
  }

  /*
   * Real iCUE controls may exist as document-level bindings without being own
   * properties on window. The shared meter runtime predates that behavior and
   * reads a few settings from globalThis. Mirror the current binding values into
   * writable window properties whenever iCUE initializes or changes settings.
   * If inline.py already installed a live accessor, leave that accessor intact.
   */
  function syncBindingToWindow(name) {
    if (typeof globalThis.__ratpackIcueRead !== 'function') return;
    var value;
    try { value = globalThis.__ratpackIcueRead(name); }
    catch (error) { return; }
    if (value === undefined) return;

    try {
      var descriptor = Object.getOwnPropertyDescriptor(globalThis, name);
      if (descriptor && (descriptor.get || descriptor.set)) return;
      if (!descriptor) {
        Object.defineProperty(globalThis, name, {
          configurable: true,
          enumerable: true,
          writable: true,
          value: value
        });
      } else if (descriptor.writable !== false) {
        globalThis[name] = value;
      }
    } catch (error) {}
  }

  function syncAllBindings() {
    try {
      var bridge = globalThis.__ratpackIcueBindingBridge;
      var names = bridge && Array.isArray(bridge.names) ? bridge.names : [];
      names.forEach(syncBindingToWindow);
    } catch (error) {}
  }

  function forceSensorScan() {
    try {
      if (globalThis.PackRatPowerMeterTest && typeof globalThis.PackRatPowerMeterTest.forceScan === 'function') {
        globalThis.PackRatPowerMeterTest.forceScan();
      }
    } catch (error) {
      console.error('PC Power Meter sensor refresh failed', error);
    }
  }

  function refresh() {
    syncAllBindings();
    var root = document.documentElement;
    if (root) {
      root.style.setProperty('--text', String(read('textColor', '#F4F6F8')));
      root.style.setProperty('--accent', String(read('accentColor', '#2BE86A')));
      root.style.setProperty('--background', String(read('backgroundColor', '#070A0D')));
      root.style.setProperty('--graph', String(read('graphColor', '#2BE86A')));
    }
    forceSensorScan();
  }

  function onSensorsPluginReady() {
    syncAllBindings();
    forceSensorScan();
  }

  icueEvents = {
    onICUEInitialized: refresh,
    onDataUpdated: refresh
  };
  globalThis.icueEvents = icueEvents;

  /* CORSAIR's documented Sensors plugin lifecycle. */
  pluginSensorsdataproviderEvents = {
    onInitialized: onSensorsPluginReady
  };
  globalThis.pluginSensorsdataproviderEvents = pluginSensorsdataproviderEvents;

  try {
    if (typeof iCUE_initialized !== 'undefined' && iCUE_initialized) refresh();
  } catch (error) {}
  try {
    if (typeof pluginSensorsdataprovider_initialized !== 'undefined' && pluginSensorsdataprovider_initialized) onSensorsPluginReady();
  } catch (error) {}
})();
