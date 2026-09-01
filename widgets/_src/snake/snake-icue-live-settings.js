/* PackRat Snake live iCUE settings bridge. Shipping builds inline this file. */
(() => {
  "use strict";

  const SETTING_NAMES = ["themePreset", "showTouchGuides"];
  const existingEvents = globalThis.icueEvents || {};
  const originalInitialized = typeof existingEvents.onICUEInitialized === "function"
    ? existingEvents.onICUEInitialized.bind(existingEvents)
    : null;
  const originalDataUpdated = typeof existingEvents.onDataUpdated === "function"
    ? existingEvents.onDataUpdated.bind(existingEvents)
    : null;

  let settingsSnapshot = "";
  let settingsWatchTimer = null;

  function readBinding(name) {
    try {
      if (typeof globalThis.__ratpackIcueRead === "function") {
        const direct = globalThis.__ratpackIcueRead(name);
        if (direct !== undefined && direct !== null) return direct;
      }
      const value = globalThis[name];
      return value === undefined || value === null ? undefined : value;
    } catch (_) {
      return undefined;
    }
  }

  function syncBindingToWindow(name) {
    const value = readBinding(name);
    if (value === undefined) return;

    try {
      const descriptor = Object.getOwnPropertyDescriptor(globalThis, name);
      if (descriptor && (descriptor.get || descriptor.set)) return;
      if (!descriptor) {
        Object.defineProperty(globalThis, name, {
          configurable: true,
          enumerable: true,
          writable: true,
          value
        });
      } else if (descriptor.writable !== false) {
        globalThis[name] = value;
      }
    } catch (_) {}
  }

  function syncAllBindings() {
    SETTING_NAMES.forEach(syncBindingToWindow);
  }

  function settingsSignature() {
    return SETTING_NAMES.map(name => String(readBinding(name))).join("|");
  }

  function applyCurrentSettings(callback) {
    syncAllBindings();
    settingsSnapshot = settingsSignature();
    if (callback) callback();
  }

  function startSettingsWatcher() {
    if (settingsWatchTimer) return;
    applyCurrentSettings(originalDataUpdated);
    settingsWatchTimer = globalThis.setInterval(() => {
      const next = settingsSignature();
      if (next === settingsSnapshot) return;
      applyCurrentSettings(originalDataUpdated);
    }, 200);
  }

  globalThis.icueEvents = {
    ...existingEvents,
    onICUEInitialized(...args) {
      syncAllBindings();
      settingsSnapshot = settingsSignature();
      if (originalInitialized) originalInitialized(...args);
    },
    onDataUpdated(...args) {
      syncAllBindings();
      settingsSnapshot = settingsSignature();
      if (originalDataUpdated) originalDataUpdated(...args);
    }
  };

  globalThis.addEventListener("pagehide", () => {
    if (settingsWatchTimer) globalThis.clearInterval(settingsWatchTimer);
    settingsWatchTimer = null;
  });

  startSettingsWatcher();
})();
