/* Peripheral Battery Panel for XENEON Edge.
 * Uses only the documented iCUE Sensors provider. No remaining time is derived
 * from battery percentage. A time estimate is shown only when provider text
 * explicitly contains one.
 */

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

var sensorRequestId = 2000;
var sensorPending = {};
var sensorSignalPlugin = null;
var sensorEventsPlugin = null;
var scanRunning = false;
var rescanTimer = null;
var reconcileTimer = null;
var cards = [];
var sensorToCard = {};
var detailModes = {};
var started = false;
var translationsReady = false;
var lastLiveScan = 0;
var wirelessDeviceLabel = "Wireless device";

function getIcueProperty(name, fallback) {
  try {
    var value = globalThis[name];
    if (typeof Node !== "undefined" && value instanceof Node) return fallback;
    if (value === undefined || value === null) return fallback;
    return value;
  } catch (e) { return fallback; }
}

function instanceKey(namespace) {
  var id = "packrat";
  try { if (typeof uniqueId !== "undefined" && uniqueId) id = String(uniqueId); } catch (e) { }
  return id + ":rig-battery:" + namespace;
}

function storeRead(namespace, fallback) {
  try {
    var raw = localStorage.getItem(instanceKey(namespace));
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) { return fallback; }
}

function storeWrite(namespace, value) {
  try { localStorage.setItem(instanceKey(namespace), JSON.stringify(value)); } catch (e) { }
}

async function t(key) {
  try {
    if (typeof tr === "function") {
      var value = await tr(key);
      if (value !== undefined && value !== null && String(value)) return String(value);
    }
  } catch (e) { }
  return key;
}

function setText(id, value) {
  var el = document.getElementById(id);
  if (el) el.textContent = value;
}

function nearestSlot() {
  var w = Math.max(1, window.innerWidth || document.documentElement.clientWidth || 840);
  var h = Math.max(1, window.innerHeight || document.documentElement.clientHeight || 344);
  var best = SLOT_SPECS[0];
  var score = Infinity;
  for (var i = 0; i < SLOT_SPECS.length; i++) {
    var s = SLOT_SPECS[i];
    var next = Math.abs(Math.log(w / s.w)) + Math.abs(Math.log(h / s.h));
    if (next < score) { score = next; best = s; }
  }
  return best.id;
}

function applySlot() {
  document.body.setAttribute("data-slot", nearestSlot());
}

function readSettings() {
  var threshold = Number(getIcueProperty("lowBatteryThreshold", 20));
  if (!Number.isFinite(threshold)) threshold = 20;
  return {
    threshold: Math.max(5, Math.min(50, threshold)),
    text: String(getIcueProperty("textColor", "#F4F6F8") || "#F4F6F8"),
    accent: String(getIcueProperty("accentColor", "#2BE86A") || "#2BE86A"),
    background: String(getIcueProperty("backgroundColor", "#070A0D") || "#070A0D")
  };
}

function applySettings() {
  var cfg = readSettings();
  document.documentElement.style.setProperty("--text", cfg.text);
  document.documentElement.style.setProperty("--accent", cfg.accent);
  document.documentElement.style.setProperty("--bg", cfg.background);
  renderCards();
}

function sensorPlugin() {
  try { return window.plugins && window.plugins.Sensorsdataprovider; }
  catch (e) { return null; }
}

function connectAsync(plugin) {
  if (!plugin) return false;
  if (sensorSignalPlugin === plugin) return true;
  if (!plugin.asyncResponse || typeof plugin.asyncResponse.connect !== "function") return false;
  try {
    plugin.asyncResponse.connect(function (requestId, value) {
      var pending = sensorPending[requestId];
      if (!pending) return;
      clearTimeout(pending.timer);
      delete sensorPending[requestId];
      pending.resolve(value);
    });
    sensorSignalPlugin = plugin;
    return true;
  } catch (e) { return false; }
}

function ask(method, args) {
  var plugin = sensorPlugin();
  if (!plugin || typeof plugin[method] !== "function" || !connectAsync(plugin)) return Promise.resolve(null);
  var id = ++sensorRequestId;
  return new Promise(function (resolve) {
    var timer = setTimeout(function () {
      if (sensorPending[id]) delete sensorPending[id];
      resolve(null);
    }, 4000);
    sensorPending[id] = { resolve: resolve, timer: timer };
    try { plugin[method].apply(plugin, [id].concat(args || [])); }
    catch (e) {
      clearTimeout(timer);
      delete sensorPending[id];
      resolve(null);
    }
  });
}

function scheduleScan(delay) {
  clearTimeout(rescanTimer);
  rescanTimer = setTimeout(scanSensors, delay == null ? 120 : delay);
}

function connectSensorEvents(plugin) {
  if (!plugin || sensorEventsPlugin === plugin) return;
  try {
    if (plugin.sensorAdded && typeof plugin.sensorAdded.connect === "function") {
      plugin.sensorAdded.connect(function () { scheduleScan(80); });
    }
    if (plugin.sensorRemoved && typeof plugin.sensorRemoved.connect === "function") {
      plugin.sensorRemoved.connect(function () { scheduleScan(80); });
    }
    if (plugin.sensorDataChanged && typeof plugin.sensorDataChanged.connect === "function") {
      plugin.sensorDataChanged.connect(function (sensorId) {
        if (sensorToCard[String(sensorId)]) scheduleScan(110);
      });
    }
    if (plugin.sensorUnitsChanged && typeof plugin.sensorUnitsChanged.connect === "function") {
      plugin.sensorUnitsChanged.connect(function (sensorId) {
        if (sensorToCard[String(sensorId)]) scheduleScan(110);
      });
    }
    if (plugin.sensorValueChanged && typeof plugin.sensorValueChanged.connect === "function") {
      plugin.sensorValueChanged.connect(function (sensorId, value) {
        updateOneSensor(String(sensorId), value);
      });
    }
    sensorEventsPlugin = plugin;
  } catch (e) { }
}

function parsePercent(value) {
  if (value === null || value === undefined) return null;
  var match = String(value).replace(",", ".").match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  var number = Number(match[0]);
  if (!Number.isFinite(number)) return null;
  return Math.max(0, Math.min(100, number));
}

function parseEtaMinutes(value, units) {
  var text = String(value == null ? "" : value).trim();
  var unit = String(units == null ? "" : units).trim().toLowerCase();
  if (!text) return null;

  var clock = text.match(/\b(\d{1,2}):(\d{2})\b/);
  if (clock) {
    var hours = Number(clock[1]);
    var minutes = Number(clock[2]);
    if (minutes < 60 && hours <= 72) return hours * 60 + minutes;
  }

  var hourText = text.match(/\b(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)\b/i);
  var minuteText = text.match(/\b(\d+(?:\.\d+)?)\s*(?:m|min|mins|minute|minutes)\b/i);
  if (hourText || minuteText) {
    return Math.round((hourText ? Number(hourText[1]) * 60 : 0) + (minuteText ? Number(minuteText[1]) : 0));
  }

  var numeric = text.match(/^\s*(\d+(?:\.\d+)?)\s*$/);
  if (numeric && /^(min|mins|minute|minutes)$/.test(unit)) return Math.round(Number(numeric[1]));
  if (numeric && /^(h|hr|hrs|hour|hours)$/.test(unit)) return Math.round(Number(numeric[1]) * 60);
  return null;
}

function statusInfo(value, units) {
  var raw = String(value == null ? "" : value).trim();
  var lower = raw.toLowerCase();
  var eta = parseEtaMinutes(raw, units);
  var state = "unknown";
  if (/not charging|discharg|on battery/.test(lower)) state = "discharging";
  else if (/charging|recharging|charge in progress/.test(lower)) state = "charging";
  else if (/fully charged|full charge|\bfull\b/.test(lower)) state = "full";
  return { raw: raw, state: state, etaMinutes: eta };
}
