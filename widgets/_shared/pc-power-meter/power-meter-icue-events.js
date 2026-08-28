/* PackRat PC Power Meter iCUE host lifecycle. Shipping builds inline this file. */
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

  function refresh() {
    var root = document.documentElement;
    if (root) {
      root.style.setProperty('--text', String(read('textColor', '#F4F6F8')));
      root.style.setProperty('--accent', String(read('accentColor', '#2BE86A')));
      root.style.setProperty('--background', String(read('backgroundColor', '#070A0D')));
      root.style.setProperty('--graph', String(read('graphColor', '#2BE86A')));
    }
    try {
      if (globalThis.PackRatPowerMeterTest && typeof globalThis.PackRatPowerMeterTest.forceScan === 'function') {
        globalThis.PackRatPowerMeterTest.forceScan();
      }
    } catch (error) {
      console.error('PC Power Meter iCUE settings refresh failed', error);
    }
  }

  globalThis.icueEvents = {
    onICUEInitialized: refresh,
    onDataUpdated: refresh
  };
})();
