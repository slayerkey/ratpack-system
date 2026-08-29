/* PackRat Weather Timeline iCUE host lifecycle. Shipping builds inline this file. */
(function () {
  'use strict';

  function refresh() {
    try {
      window.dispatchEvent(new Event('icue-widget-settings-changed'));
    } catch (error) {
      try {
        if (globalThis.__weatherTimeline && typeof globalThis.__weatherTimeline.reload === 'function') {
          globalThis.__weatherTimeline.reload();
        }
      } catch (fallbackError) {
        console.error('Weather Timeline iCUE settings refresh failed', fallbackError);
      }
    }
  }

  globalThis.icueEvents = {
    onICUEInitialized: refresh,
    onDataUpdated: refresh
  };
})();
