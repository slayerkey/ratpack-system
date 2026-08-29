/* Network Dashboard user-facing polish that is intentionally isolated from the
 * probe/speed transport. This keeps monitoring behavior stable while exposing
 * the same kind of presentation controls used by mature PackRat dashboards. */
(function () {
  "use strict";

  var applyingHeader = false;
  var headerObserver = null;

  function directBinding(name) {
    try {
      if (typeof globalThis.__ratpackIcueRead === "function") {
        var bridged = globalThis.__ratpackIcueRead(name);
        if (bridged !== undefined && bridged !== null) return bridged;
      }
    } catch (error) { }

    try {
      switch (name) {
        case "customHeader": return typeof customHeader !== "undefined" ? customHeader : undefined;
        case "hostTextSize": return typeof hostTextSize !== "undefined" ? hostTextSize : undefined;
        case "transparency": return typeof transparency !== "undefined" ? transparency : undefined;
      }
    } catch (error) { }

    try {
      var globalValue = globalThis[name];
      if (globalValue !== undefined && globalValue !== null) return globalValue;
    } catch (error) { }
    return undefined;
  }

  function clamp(value, min, max, fallback) {
    var number = Number(value);
    if (!Number.isFinite(number)) number = fallback;
    return Math.max(min, Math.min(max, number));
  }

  function customHeading() {
    var value = directBinding("customHeader");
    return value == null ? "" : String(value).trim().slice(0, 48);
  }

  function applyHeader() {
    if (typeof document === "undefined") return;
    var node = document.getElementById("ribbonEyebrow");
    if (!node) return;
    var heading = customHeading();
    if (!heading) return;
    if (node.textContent === heading) return;
    applyingHeader = true;
    node.textContent = heading;
    applyingHeader = false;
  }

  function applyNetworkUiSettings() {
    if (typeof document === "undefined") return;
    var root = document.documentElement;
    var size = clamp(directBinding("hostTextSize"), 12, 24, 15);
    var opacity = clamp(directBinding("transparency"), 0, 100, 100);
    root.style.setProperty("--net-user-host-size", size + "px");
    /* CORSAIR's control convention is 100 = opaque, 0 = transparent. */
    root.style.setProperty("--net-background-factor", String(opacity / 100));
    applyHeader();
  }

  function watchTranslatedHeader() {
    if (typeof MutationObserver !== "function" || typeof document === "undefined") return;
    var node = document.getElementById("ribbonEyebrow");
    if (!node || headerObserver) return;
    headerObserver = new MutationObserver(function () {
      if (!applyingHeader && customHeading()) applyHeader();
    });
    headerObserver.observe(node, { childList: true, characterData: true, subtree: true });
  }

  function installEventHooks() {
    try {
      if (!globalThis.icueEvents || globalThis.icueEvents.__networkUiPatch) return;
      var originalInit = globalThis.icueEvents.onICUEInitialized;
      var originalUpdate = globalThis.icueEvents.onDataUpdated;
      globalThis.icueEvents.onICUEInitialized = function () {
        if (typeof originalInit === "function") originalInit.apply(this, arguments);
        applyNetworkUiSettings();
        watchTranslatedHeader();
      };
      globalThis.icueEvents.onDataUpdated = function () {
        if (typeof originalUpdate === "function") originalUpdate.apply(this, arguments);
        applyNetworkUiSettings();
      };
      globalThis.icueEvents.__networkUiPatch = true;
    } catch (error) { }
  }

  function start() {
    applyNetworkUiSettings();
    watchTranslatedHeader();
    installEventHooks();
    /* Translation is asynchronous. One delayed pass covers hosts where the
     * MutationObserver is unavailable without polling continuously. */
    setTimeout(applyNetworkUiSettings, 250);
  }

  globalThis.__netDashboardUiTest = {
    apply: applyNetworkUiSettings,
    customHeading: customHeading,
    clamp: clamp
  };

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
    else start();
  }
})();
