/* XENEON EDGE Ultimate real-iCUE settings watcher.
 *
 * Real iCUE can expose x-icue-property values as document-level lexical bindings
 * and has previously failed to invoke legacy widget update paths consistently.
 * Watch the bindings directly so Custom Style, layout and sensor changes apply
 * without navigating away from the widget or reloading it.
 */
(function () {
  "use strict";

  var SETTING_NAMES = [
    "preset", "startMode", "smartMode", "use24Hour", "temperatureUnit",
    "weatherEnabled", "weatherLatitude", "weatherLongitude", "calendarUrl",
    "focusMinutes", "pinnedNote", "graphWindow",
    "cpuTempSensor", "gpuTempSensor", "cpuLoadSensor", "gpuLoadSensor",
    "textColor", "accentColor", "backgroundColor"
  ];

  var snapshot = "";
  var timer = null;

  function readBinding(name) {
    try {
      if (typeof globalThis.__ratpackIcueRead === "function") {
        var direct = globalThis.__ratpackIcueRead(name);
        if (direct !== undefined && direct !== null) return direct;
      }
      var value = globalThis[name];
      return value === undefined || value === null ? undefined : value;
    } catch (e) { return undefined; }
  }

  function stable(value) {
    if (value === undefined) return "__undefined__";
    try { return JSON.stringify(value); }
    catch (e) { return String(value); }
  }

  function signature() {
    return SETTING_NAMES.map(function (name) { return name + ":" + stable(readBinding(name)); }).join("|");
  }

  function applyLiveSettings() {
    try {
      if (typeof globalThis.__ratpackIcueSyncGlobals === "function") globalThis.__ratpackIcueSyncGlobals();
    } catch (e) {}
    try {
      if (typeof syncSettings === "function") syncSettings(true);
    } catch (e2) {
      try { runtimeWarning("live settings", e2); } catch (ignored) {}
    }
    try {
      if (typeof applySensorOverrides === "function" && typeof settings === "function") applySensorOverrides(settings());
    } catch (e3) {}
    try {
      if (typeof optionalRuntime === "function" && typeof pollSensors === "function") optionalRuntime("live sensor selection", pollSensors);
    } catch (e4) {}
  }

  function tick() {
    var next = signature();
    if (next === snapshot) return;
    snapshot = next;
    applyLiveSettings();
  }

  snapshot = signature();
  timer = globalThis.setInterval(tick, 150);
  globalThis.addEventListener("pagehide", function () {
    if (timer) globalThis.clearInterval(timer);
    timer = null;
  });
})();
