/* PackRat Work Session Tracker iCUE host lifecycle. Shipping builds inline this file. */
(function () {
  'use strict';

  function refresh() {
    try {
      if (globalThis.__workSessionTest && typeof globalThis.__workSessionTest.render === 'function') {
        globalThis.__workSessionTest.render();
      }
    } catch (error) {
      console.error('Work Session Tracker iCUE settings refresh failed', error);
    }
  }

  globalThis.icueEvents = {
    onICUEInitialized: refresh,
    onDataUpdated: refresh
  };
})();
