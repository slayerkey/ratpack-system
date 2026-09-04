/* XENEON EDGE Ultimate
 * Native-first all-in-one XENEON dashboard.
 * Core product deliberately uses only documented iCUE Sensors, FPS and Media providers.
 * Weather and ICS are optional direct HTTPS fetches. No PackRat cloud is required.
 */
"use strict";

var SLOT_SPECS = [
  { id: "s-h", w: 840, h: 344 },
  { id: "s-v", w: 696, h: 416 },
  { id: "m-h", w: 840, h: 696 },
  { id: "m-v", w: 696, h: 840 },
  { id: "l-h", w: 1688, h: 696 },
  { id: "l-v", w: 696, h: 1688 },
  { id: "xl-h", w: 2536, h: 696 },
  { id: "xl-v", w: 696, h: 2536 }
];

var state = {
  started: false,
  mode: "home",
  manualHoldUntil: 0,
  preview: false,
  sensorCatalog: {},
  autoSensorRoles: { cpuTemp: null, gpuTemp: null, cpuLoad: null, gpuLoad: null },
  sensorRoles: { cpuTemp: null, gpuTemp: null, cpuLoad: null, gpuLoad: null },
  metrics: { cpuTemp: null, gpuTemp: null, cpuLoad: null, gpuLoad: null },
  history: { fps: [], cpuTemp: [], gpuTemp: [], cpuLoad: [], gpuLoad: [], network: [] },
  fps: { available: false, value: null, process: "", activeStreak: 0, inactiveStreak: 0 },
  media: { title: "", artist: "", available: false, lastAction: "", lastActionAt: 0 },
  weather: { ready: false, loading: false, error: "", current: null, hourly: [], daily: null, updatedAt: 0 },
  calendar: { ready: false, loading: false, error: "", events: [], updatedAt: 0 },
  network: { current: null, jitter: null, failures: 0, verified: 0, state: "checking", lastOk: 0 },
  focus: { running: false, endsAt: 0, remainingMs: 25 * 60000 },
  timers: [],
  pending: { sensors: {}, fps: {}, media: {} },
  requestId: 7000,
  connectedPlugins: {},
  appliedSettings: null,
  settingsFingerprint: ""
};

function byId(id) { return document.getElementById(id); }
function setText(id, value) { var el = byId(id); if (el) el.textContent = value; }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function finite(value) { var n = Number(value); return Number.isFinite(n) ? n : null; }

function getIcueProperty(name, fallback) {
  try {
    if (typeof globalThis.__ratpackIcueRead === "function") {
      var direct = globalThis.__ratpackIcueRead(name);
      if (direct !== undefined && direct !== null) return direct;
    }
  } catch (e) {}
  try {
    var value = globalThis[name];
    if (typeof Node !== "undefined" && value instanceof Node) return fallback;
    if (value === undefined || value === null) return fallback;
    return value;
  } catch (e2) { return fallback; }
}

function settings() {
  var preset = String(getIcueProperty("preset", "everyday") || "everyday").toLowerCase();
  var startMode = String(getIcueProperty("startMode", "auto") || "auto").toLowerCase();
  var temp = String(getIcueProperty("temperatureUnit", "f") || "f").toLowerCase();
  var graph = String(getIcueProperty("graphWindow", "5m") || "5m").toLowerCase();
  if (["everyday","gaming","work","minimal","enthusiast"].indexOf(preset) < 0) preset = "everyday";
  if (["auto","home","performance","today","ambient"].indexOf(startMode) < 0) startMode = "auto";
  if (["f","c"].indexOf(temp) < 0) temp = "f";
  if (["60s","5m","15m"].indexOf(graph) < 0) graph = "5m";
  return {
    preset: preset,
    startMode: startMode,
    smartMode: getIcueProperty("smartMode", true) !== false,
    use24: getIcueProperty("use24Hour", false) === true,
    tempUnit: temp,
    weatherEnabled: getIcueProperty("weatherEnabled", true) !== false,
    weatherLatitude: String(getIcueProperty("weatherLatitude", "") || "").trim(),
    weatherLongitude: String(getIcueProperty("weatherLongitude", "") || "").trim(),
    calendarUrl: String(getIcueProperty("calendarUrl", "") || "").trim(),
    focusMinutes: clamp(Number(getIcueProperty("focusMinutes", 25)) || 25, 10, 90),
    pinnedNote: String(getIcueProperty("pinnedNote", "") || "").trim(),
    graphWindow: graph,
    cpuTempSensor: String(getIcueProperty("cpuTempSensor", "") || "").trim(),
    gpuTempSensor: String(getIcueProperty("gpuTempSensor", "") || "").trim(),
    cpuLoadSensor: String(getIcueProperty("cpuLoadSensor", "") || "").trim(),
    gpuLoadSensor: String(getIcueProperty("gpuLoadSensor", "") || "").trim(),
    text: String(getIcueProperty("textColor", "#F5F7FA") || "#F5F7FA"),
    accent: String(getIcueProperty("accentColor", "#2BE86A") || "#2BE86A"),
    background: String(getIcueProperty("backgroundColor", "#07090D") || "#07090D")
  };
}

function settingsFingerprint(cfg) {
  return JSON.stringify([
    cfg.preset, cfg.startMode, cfg.smartMode, cfg.use24, cfg.tempUnit,
    cfg.weatherEnabled, cfg.weatherLatitude, cfg.weatherLongitude, cfg.calendarUrl,
    cfg.focusMinutes, cfg.pinnedNote, cfg.graphWindow,
    cfg.cpuTempSensor, cfg.gpuTempSensor, cfg.cpuLoadSensor, cfg.gpuLoadSensor,
    cfg.text, cfg.accent, cfg.background
  ]);
}

function instanceKey(namespace) {
  var id = "packrat";
  try { if (typeof uniqueId !== "undefined" && uniqueId) id = String(uniqueId); } catch (e) {}
  return id + ":xeneon-edge-ultimate:" + namespace;
}
function storeRead(namespace, fallback) {
  try {
    var raw = localStorage.getItem(instanceKey(namespace));
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) { return fallback; }
}
function storeWrite(namespace, value) {
  try { localStorage.setItem(instanceKey(namespace), JSON.stringify(value)); } catch (e) {}
}

function isPreview() {
  try { return !!(globalThis.iCUE && globalThis.iCUE.isPreview); } catch (e) { return false; }
}

function nearestSlot() {
  var w = Math.max(1, window.innerWidth || document.documentElement.clientWidth || 2536);
  var h = Math.max(1, window.innerHeight || document.documentElement.clientHeight || 696);
  var best = SLOT_SPECS[0], bestScore = Infinity;
  SLOT_SPECS.forEach(function (slot) {
    var score = Math.abs(Math.log(w / slot.w)) + Math.abs(Math.log(h / slot.h));
    if (score < bestScore) { best = slot; bestScore = score; }
  });
  return best.id;
}

function applySlot() {
  document.body.setAttribute("data-slot", nearestSlot());
  requestAnimationFrame(function () {
    drawPerformanceGraph();
    drawNetworkSpark();
    drawWeatherSpark();
  });
}
