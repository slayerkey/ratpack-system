/* Stream Dashboard for XENEON Edge.
 *
 * obs-websocket v5 is the source of truth. Bitrate is derived from outputBytes
 * deltas. Dropped frames use GetStreamStatus. Encoder lag uses GetStats output
 * skipped frames. The widget does not invent encoder utilization or other data.
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

var EVENT_SUBSCRIPTIONS = 4 | 64;
var CACHE_VERSION = 1;
var obsSocket = null;
var obsIdentified = false;
var obsConnecting = false;
var obsReconnectTimer = null;
var obsReconnectAttempt = 0;
var obsPollTimer = null;
var obsSceneRefreshTimer = null;
var obsPending = {};
var obsRequestSeq = 0;
var currentConnectionKey = "";
var pendingStreamAction = null;
var pendingStreamTimer = null;
var toastTimer = null;
var widgetStarted = false;
var translationsReady = false;
var cacheStoreKey = "";
var lastBytes = null;
var lastBytesAt = null;

var dashboard = {
  connected: false,
  connectionReason: "connecting",
  lastError: "",
  obsVersion: "",
  webSocketVersion: "",
  stream: {
    active: false,
    reconnecting: false,
    duration: 0,
    timecode: "00:00:00",
    outputBytes: 0,
    skippedFrames: 0,
    totalFrames: 0,
    congestion: 0
  },
  record: {
    active: false,
    paused: false,
    duration: 0,
    timecode: "00:00:00"
  },
  stats: {
    availableDiskSpace: null,
    outputSkippedFrames: 0,
    outputTotalFrames: 0,
    renderSkippedFrames: 0,
    renderTotalFrames: 0
  },
  bitrate: 0,
  bitrateHistory: [],
  scenes: [],
  currentScene: "",
  updatedAt: 0,
  restoredFromCache: false
};

function getIcueProperty(name, fallback) {
  try {
    var value = globalThis[name];
    if (typeof Node !== "undefined" && value instanceof Node) return fallback;
    if (value === undefined || value === null) return fallback;
    return value;
  } catch (error) {
    return fallback;
  }
}

function instanceId() {
  var id = "packrat";
  try {
    if (typeof uniqueId !== "undefined" && uniqueId) id = String(uniqueId);
  } catch (error) { }
  return id;
}

function safePort(raw) {
  var value = String(raw === undefined || raw === null ? "4455" : raw).trim();
  if (!/^\d{1,5}$/.test(value)) return 4455;
  var number = Number(value);
  if (number < 1 || number > 65535) return 4455;
  return Math.floor(number);
}

function readSettings() {
  return {
    port: safePort(getIcueProperty("obsPort", "4455")),
    password: String(getIcueProperty("obsPassword", "") || ""),
    text: String(getIcueProperty("textColor", "#F2F5F7") || "#F2F5F7"),
    accent: String(getIcueProperty("accentColor", "#2BE86A") || "#2BE86A"),
    background: String(getIcueProperty("backgroundColor", "#0B0E11") || "#0B0E11")
  };
}

function applySettings() {
  var cfg = readSettings();
  document.documentElement.style.setProperty("--text", cfg.text);
  document.documentElement.style.setProperty("--accent", cfg.accent);
  document.documentElement.style.setProperty("--bg", cfg.background);
  var nextKey = cfg.port + "\u0000" + cfg.password;
  if (widgetStarted && nextKey !== currentConnectionKey) {
    currentConnectionKey = nextKey;
    disconnectObs(false);
    connectObs();
  }
}

async function t(key) {
  try {
    if (typeof tr === "function") {
      var value = await tr(key);
      if (value !== undefined && value !== null && String(value)) return String(value);
    }
  } catch (error) { }
  return key;
}

async function translateRuntime() {
  var keys = [
    "Stream Dashboard",
    "Start or stop stream",
    "Scenes",
    "Scene list",
    "STREAM DASHBOARD",
    "CONNECTING TO OBS",
    "OBS NOT CONNECTED",
    "OBS AUTH FAILED",
    "Open OBS and enable its WebSocket server.",
    "Enable the OBS WebSocket server in Tools, then enter the same port and password here.",
    "Check the OBS WebSocket password in widget settings.",
    "CONNECTED",
    "CONNECTING",
    "STANDBY",
    "LIVE",
    "RECONNECTING",
    "START STREAM?",
    "STOP STREAM?",
    "Starting stream",
    "Stopping stream",
    "Scene switched",
    "Could not switch scene",
    "Could not change stream state",
    "No scene",
    "SCENE",
    "SCENES",
    "WAITING FOR OBS",
    "LAST UPDATE",
    "STREAM OUTPUT",
    "BITRATE",
    "LAST 60 SEC",
    "DROPPED",
    "ENCODER LAG",
    "PROGRAM",
    "REC",
    "DISK FREE",
    "ON",
    "OFF",
    "PAUSED"
  ];
  var values = await Promise.all(keys.map(function (key) { return t(key); }));
  var map = {};
  keys.forEach(function (key, index) { map[key] = values[index]; });
  window.__obsTranslations = map;
  document.getElementById("stage").setAttribute("aria-label", map["Stream Dashboard"]);
  document.getElementById("streamControl").setAttribute("aria-label", map["Start or stop stream"]);
  document.getElementById("scenesPanel").setAttribute("aria-label", map["Scenes"]);
  document.getElementById("sceneRail").setAttribute("aria-label", map["Scene list"]);
  setText("streamSubline", map["STREAM OUTPUT"]);
  setText("bitrateLabel", map["BITRATE"]);
  setText("chartCaption", map["LAST 60 SEC"]);
  setText("droppedLabel", map["DROPPED"]);
  setText("encoderLabel", map["ENCODER LAG"]);
  setText("programLabel", map["PROGRAM"]);
  setText("recordLabel", map["REC"]);
  setText("diskLabel", map["DISK FREE"]);
  translationsReady = true;
  renderAll();
}

function tt(key) {
  var map = window.__obsTranslations || {};
  return map[key] || key;
}

function setText(id, value) {
  var element = document.getElementById(id);
  if (element) element.textContent = value;
}

function cacheKey() {
  if (!cacheStoreKey) cacheStoreKey = instanceId() + ":obs-dashboard:state";
  return cacheStoreKey;
}

function loadCache() {
  try {
    var raw = localStorage.getItem(cacheKey());
    if (!raw) return false;
    var parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== CACHE_VERSION || !parsed.state) return false;
    var state = parsed.state;
    if (state.stream) Object.assign(dashboard.stream, state.stream);
    if (state.record) Object.assign(dashboard.record, state.record);
    if (state.stats) Object.assign(dashboard.stats, state.stats);
    dashboard.bitrate = Number(state.bitrate) || 0;
    dashboard.bitrateHistory = Array.isArray(state.bitrateHistory) ? state.bitrateHistory.slice(-60) : [];
    dashboard.scenes = Array.isArray(state.scenes) ? state.scenes.slice(0, 100) : [];
    dashboard.currentScene = String(state.currentScene || "");
    dashboard.updatedAt = Number(state.updatedAt) || 0;
    dashboard.restoredFromCache = true;
    document.body.setAttribute("data-has-cache", "true");
    return true;
  } catch (error) {
    return false;
  }
}

function saveCache() {
  if (!dashboard.updatedAt) return;
  try {
    var safe = {
      version: CACHE_VERSION,
      state: {
        stream: dashboard.stream,
        record: dashboard.record,
        stats: dashboard.stats,
        bitrate: dashboard.bitrate,
        bitrateHistory: dashboard.bitrateHistory.slice(-60),
        scenes: dashboard.scenes.slice(0, 100),
        currentScene: dashboard.currentScene,
        updatedAt: dashboard.updatedAt
      }
    };
    localStorage.setItem(cacheKey(), JSON.stringify(safe));
    document.body.setAttribute("data-has-cache", "true");
  } catch (error) { }
}

function nearestSlot() {
  var width = Math.max(1, window.innerWidth || document.documentElement.clientWidth || 840);
  var height = Math.max(1, window.innerHeight || document.documentElement.clientHeight || 344);
  var best = SLOT_SPECS[0];
  var bestScore = Infinity;
  for (var i = 0; i < SLOT_SPECS.length; i++) {
    var spec = SLOT_SPECS[i];
    var score = Math.abs(Math.log(width / spec.w)) + Math.abs(Math.log(height / spec.h));
    if (score < bestScore) {
      bestScore = score;
      best = spec;
    }
  }
  return best.id;
}

function applySlot() {
  document.body.setAttribute("data-slot", nearestSlot());
  if (widgetStarted) renderScenes();
}

function percent(skipped, total) {
  var s = Number(skipped) || 0;
  var t0 = Number(total) || 0;
  if (t0 <= 0 || s <= 0) return 0;
  return Math.max(0, Math.min(100, (s / t0) * 100));
}

function metricLevel(value) {
  if (value >= 5) return "danger";
  if (value >= 1) return "warn";
  return "good";
}

function formatDuration(ms, fallback) {
  var value = Number(ms);
  if (!Number.isFinite(value) || value < 0) return fallback || "00:00:00";
  var total = Math.floor(value / 1000);
  var hours = Math.floor(total / 3600);
  var minutes = Math.floor((total % 3600) / 60);
  var seconds = total % 60;
  return String(hours).padStart(2, "0") + ":" + String(minutes).padStart(2, "0") + ":" + String(seconds).padStart(2, "0");
}

function formatDisk(mb) {
  var value = Number(mb);
  if (!Number.isFinite(value) || value < 0) return "-- GB";
  var gb = value / 1024;
  if (gb >= 100) return Math.round(gb) + " GB";
  return gb.toFixed(1) + " GB";
}

function historyPath(values) {
  var series = Array.isArray(values) ? values.slice(-60) : [];
  if (!series.length) return { line: "", area: "" };
  while (series.length < 60) series.unshift(0);
  var max = Math.max.apply(null, series.concat([1]));
  var points = [];
  for (var i = 0; i < series.length; i++) {
    var x = (i / (series.length - 1)) * 1000;
    var y = 174 - (Math.max(0, Number(series[i]) || 0) / max) * 154;
    points.push([x, y]);
  }
  var line = "M" + points.map(function (point) { return point[0].toFixed(1) + "," + point[1].toFixed(1); }).join(" L");
  var area = line + " L1000,190 L0,190 Z";
  return { line: line, area: area };
}

function renderConnection() {
  var body = document.body;
  body.setAttribute("data-connection", dashboard.connected ? "connected" : dashboard.connectionReason || "disconnected");
  setText("connectionBadge", dashboard.connected ? tt("CONNECTED") : tt("CONNECTING"));

  if (dashboard.connected) {
    setText("freshnessText", tt("CONNECTED"));
    return;
  }

  setText("offlineKicker", tt("STREAM DASHBOARD"));
  if (dashboard.connectionReason === "auth") {
    setText("offlineTitle", tt("OBS AUTH FAILED"));
    setText("offlineHint", tt("Check the OBS WebSocket password in widget settings."));
  } else if (dashboard.connectionReason === "connecting") {
    setText("offlineTitle", tt("CONNECTING TO OBS"));
    setText("offlineHint", tt("Open OBS and enable its WebSocket server."));
  } else {
    setText("offlineTitle", tt("OBS NOT CONNECTED"));
    setText("offlineHint", tt("Enable the OBS WebSocket server in Tools, then enter the same port and password here."));
  }

  if (dashboard.updatedAt) {
    var ageSeconds = Math.max(0, Math.round((Date.now() - dashboard.updatedAt) / 1000));
    setText("freshnessText", tt("LAST UPDATE") + " " + ageSeconds + "s");
  } else {
    setText("freshnessText", tt("WAITING FOR OBS"));
  }
}

function renderStream() {
  var stateText = tt("STANDBY");
  var state = "standby";
  if (dashboard.stream.reconnecting) {
    stateText = tt("RECONNECTING");
    state = "reconnecting";
  } else if (dashboard.stream.active) {
    stateText = tt("LIVE");
    state = "live";
  }
  document.body.setAttribute("data-stream", state);
  if (!pendingStreamAction) setText("stateText", stateText);
  setText("streamTimer", dashboard.stream.active ? formatDuration(dashboard.stream.duration, dashboard.stream.timecode) : "00:00:00");
}

function renderMetrics() {
  setText("bitrateValue", String(Math.round(Math.max(0, dashboard.bitrate || 0))));
  var chart = historyPath(dashboard.bitrateHistory);
  document.getElementById("bitratePath").setAttribute("d", chart.line);
  document.getElementById("bitrateArea").setAttribute("d", chart.area);

  var dropped = percent(dashboard.stream.skippedFrames, dashboard.stream.totalFrames);
  var encoder = percent(dashboard.stats.outputSkippedFrames, dashboard.stats.outputTotalFrames);
  setText("droppedValue", dropped.toFixed(1) + "%");
  setText("encoderValue", encoder.toFixed(1) + "%");
  document.getElementById("droppedCard").setAttribute("data-level", metricLevel(dropped));
  document.getElementById("encoderCard").setAttribute("data-level", metricLevel(encoder));
  document.getElementById("droppedFill").style.width = Math.min(100, dropped * 10) + "%";
  document.getElementById("encoderFill").style.width = Math.min(100, encoder * 10) + "%";
}

function sceneName(scene) {
  if (!scene) return "";
  if (typeof scene === "string") return scene;
  return String(scene.sceneName || "");
}

function renderScenes() {
  var rail = document.getElementById("sceneRail");
  if (!rail) return;
  rail.replaceChildren();
  var scenes = dashboard.scenes.filter(function (scene) { return !!sceneName(scene); });
  var sceneTotal = scenes.length;
  var slot = document.body.getAttribute("data-slot") || "s-h";
  if ((slot === "s-h" || slot === "s-v") && scenes.length > 3 && dashboard.currentScene) {
    var currentIndex = scenes.findIndex(function (scene) { return sceneName(scene) === dashboard.currentScene; });
    if (currentIndex >= 0) {
      var compact = [];
      for (var ci = 0; ci < Math.min(3, scenes.length); ci++) compact.push(scenes[(currentIndex + ci) % scenes.length]);
      scenes = compact;
    } else {
      scenes = scenes.slice(0, 3);
    }
  }
  setText("sceneCount", sceneTotal + " " + (sceneTotal === 1 ? tt("SCENE") : tt("SCENES")));
  setText("activeScene", dashboard.currentScene || tt("No scene"));

  scenes.forEach(function (scene) {
    var name = sceneName(scene);
    var button = document.createElement("button");
    button.type = "button";
    button.className = "scene-button interactive" + (name === dashboard.currentScene ? " is-current" : "");
    button.setAttribute("role", "listitem");
    button.dataset.sceneName = name;
    button.textContent = name;
    rail.appendChild(button);
  });

  requestAnimationFrame(function () {
    var current = rail.querySelector(".scene-button.is-current");
    if (current && typeof current.scrollIntoView === "function") {
      try { current.scrollIntoView({ block: "nearest", inline: "nearest" }); } catch (error) { }
    }
  });
}

function renderFooter() {
  var recordBlock = document.getElementById("recordBlock");
  recordBlock.classList.toggle("is-active", !!dashboard.record.active);
  var recordLabel = dashboard.record.active ? (dashboard.record.paused ? tt("PAUSED") : tt("ON")) : tt("OFF");
  setText("recordState", recordLabel);
  setText("recordTimer", dashboard.record.active ? formatDuration(dashboard.record.duration, dashboard.record.timecode) : "00:00:00");
  setText("diskValue", formatDisk(dashboard.stats.availableDiskSpace));
}

function renderAll() {
  renderConnection();
  renderStream();
  renderMetrics();
  renderScenes();
  renderFooter();
}

function showToast(message) {
  var element = document.getElementById("toast");
  if (!element) return;
  element.textContent = message;
  element.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { element.classList.remove("is-visible"); }, 1800);
}

function clearPendingRequests() {
  Object.keys(obsPending).forEach(function (id) {
    clearTimeout(obsPending[id].timer);
    obsPending[id].resolve(null);
    delete obsPending[id];
  });
}

function stopPolling() {
  clearInterval(obsPollTimer);
  clearInterval(obsSceneRefreshTimer);
  obsPollTimer = null;
  obsSceneRefreshTimer = null;
}

function disconnectObs(scheduleReconnect) {
  stopPolling();
  clearPendingRequests();
  obsIdentified = false;
  obsConnecting = false;
  if (obsSocket) {
    try {
      obsSocket.onopen = null;
      obsSocket.onmessage = null;
      obsSocket.onerror = null;
      obsSocket.onclose = null;
      obsSocket.close();
    } catch (error) { }
  }
  obsSocket = null;
  if (!scheduleReconnect) {
    clearTimeout(obsReconnectTimer);
    obsReconnectTimer = null;
  }
}

function scheduleReconnect() {
  clearTimeout(obsReconnectTimer);
  var delay = Math.min(10000, 800 * Math.pow(1.7, Math.min(7, obsReconnectAttempt)));
  obsReconnectAttempt += 1;
  obsReconnectTimer = setTimeout(connectObs, delay);
}

function bytesToBase64(bytes) {
  var binary = "";
  var view = new Uint8Array(bytes);
  for (var i = 0; i < view.length; i++) binary += String.fromCharCode(view[i]);
  return btoa(binary);
}

function sha256Fallback(text) {
  var bytes = new TextEncoder().encode(String(text));
  var constants = [
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
  ];
  var hash = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  var paddedLength = Math.ceil((bytes.length + 9) / 64) * 64;
  var data = new Uint8Array(paddedLength);
  data.set(bytes);
  data[bytes.length] = 0x80;
  var bitLength = bytes.length * 8;
  var high = Math.floor(bitLength / 4294967296);
  var low = bitLength >>> 0;
  for (var bi = 0; bi < 4; bi++) {
    data[paddedLength - 8 + bi] = (high >>> (24 - bi * 8)) & 255;
    data[paddedLength - 4 + bi] = (low >>> (24 - bi * 8)) & 255;
  }
  function rotr(value, bits) { return (value >>> bits) | (value << (32 - bits)); }
  var words = new Uint32Array(64);
  for (var offset = 0; offset < paddedLength; offset += 64) {
    for (var i = 0; i < 16; i++) {
      var j = offset + i * 4;
      words[i] = ((data[j] << 24) | (data[j + 1] << 16) | (data[j + 2] << 8) | data[j + 3]) >>> 0;
    }
    for (var wi = 16; wi < 64; wi++) {
      var x = words[wi - 15];
      var y = words[wi - 2];
      var s0 = rotr(x, 7) ^ rotr(x, 18) ^ (x >>> 3);
      var s1 = rotr(y, 17) ^ rotr(y, 19) ^ (y >>> 10);
      words[wi] = (words[wi - 16] + s0 + words[wi - 7] + s1) >>> 0;
    }
    var a = hash[0], b = hash[1], c = hash[2], d = hash[3];
    var e = hash[4], f = hash[5], g = hash[6], h = hash[7];
    for (var ri = 0; ri < 64; ri++) {
      var big1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      var choose = (e & f) ^ ((~e) & g);
      var temp1 = (h + big1 + choose + constants[ri] + words[ri]) >>> 0;
      var big0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      var majority = (a & b) ^ (a & c) ^ (b & c);
      var temp2 = (big0 + majority) >>> 0;
      h = g; g = f; f = e; e = (d + temp1) >>> 0;
      d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
    }
    hash[0] = (hash[0] + a) >>> 0;
    hash[1] = (hash[1] + b) >>> 0;
    hash[2] = (hash[2] + c) >>> 0;
    hash[3] = (hash[3] + d) >>> 0;
    hash[4] = (hash[4] + e) >>> 0;
    hash[5] = (hash[5] + f) >>> 0;
    hash[6] = (hash[6] + g) >>> 0;
    hash[7] = (hash[7] + h) >>> 0;
  }
  var out = new Uint8Array(32);
  for (var hi = 0; hi < 8; hi++) {
    out[hi * 4] = (hash[hi] >>> 24) & 255;
    out[hi * 4 + 1] = (hash[hi] >>> 16) & 255;
    out[hi * 4 + 2] = (hash[hi] >>> 8) & 255;
    out[hi * 4 + 3] = hash[hi] & 255;
  }
  return out.buffer;
}

async function sha256Base64(text) {
  var encoded = new TextEncoder().encode(String(text));
  var digest;
  if (globalThis.crypto && globalThis.crypto.subtle) digest = await globalThis.crypto.subtle.digest("SHA-256", encoded);
  else digest = sha256Fallback(text);
  return bytesToBase64(digest);
}

async function buildAuthentication(password, auth) {
  var secret = await sha256Base64(String(password || "") + String(auth.salt || ""));
  return sha256Base64(secret + String(auth.challenge || ""));
}

function fixtureData() {
  try {
    var value = globalThis.__PACKRAT_OBS_FIXTURE__;
    return value && typeof value === "object" ? value : null;
  } catch (error) { return null; }
}

function fixtureRequest(type, requestData) {
  var fixture = fixtureData();
  if (!fixture) return null;
  if (type === "GetStreamStatus") return Object.assign({}, fixture.stream || {});
  if (type === "GetRecordStatus") return Object.assign({}, fixture.record || {});
  if (type === "GetStats") return Object.assign({}, fixture.stats || {});
  if (type === "GetSceneList") return {
    scenes: Array.isArray(fixture.scenes) ? fixture.scenes.slice() : [],
    currentProgramSceneName: String(fixture.currentScene || "")
  };
  if (type === "GetCurrentProgramScene") return { sceneName: String(fixture.currentScene || "") };
  if (type === "SetCurrentProgramScene") {
    fixture.currentScene = String(requestData && requestData.sceneName || "");
    return {};
  }
  if (type === "StartStream") {
    fixture.stream = fixture.stream || {};
    fixture.stream.outputActive = true;
    return {};
  }
  if (type === "StopStream") {
    fixture.stream = fixture.stream || {};
    fixture.stream.outputActive = false;
    return {};
  }
  return {};
}

function obsRequest(type, requestData) {
  var fixtureResult = fixtureRequest(type, requestData);
  if (fixtureResult !== null) return Promise.resolve(fixtureResult);
  if (!obsIdentified || !obsSocket || obsSocket.readyState !== WebSocket.OPEN) return Promise.resolve(null);
  obsRequestSeq += 1;
  var id = instanceId() + "-" + Date.now() + "-" + obsRequestSeq;
  return new Promise(function (resolve) {
    var timer = setTimeout(function () {
      if (obsPending[id]) delete obsPending[id];
      resolve(null);
    }, 4000);
    obsPending[id] = { resolve: resolve, timer: timer, type: type };
    var payload = { op: 6, d: { requestType: type, requestId: id } };
    if (requestData && typeof requestData === "object") payload.d.requestData = requestData;
    try {
      obsSocket.send(JSON.stringify(payload));
    } catch (error) {
      clearTimeout(timer);
      delete obsPending[id];
      resolve(null);
    }
  });
}

function updateBitrate(streamData) {
  var now = performance.now();
  var bytes = Number(streamData.outputBytes);
  var active = !!streamData.outputActive;
  var bitrate = 0;
  if (active && Number.isFinite(bytes) && lastBytes !== null && lastBytesAt !== null && bytes >= lastBytes) {
    var elapsed = (now - lastBytesAt) / 1000;
    if (elapsed > 0.15) bitrate = ((bytes - lastBytes) * 8) / elapsed / 1000;
  }
  if (!active || !Number.isFinite(bitrate) || bitrate < 0 || bitrate > 1000000) bitrate = 0;
  lastBytes = Number.isFinite(bytes) ? bytes : null;
  lastBytesAt = now;
  dashboard.bitrate = bitrate;
  dashboard.bitrateHistory.push(Math.round(bitrate));
  dashboard.bitrateHistory = dashboard.bitrateHistory.slice(-60);
}

function applyStreamData(data) {
  if (!data) return;
  var fixture = fixtureData();
  if (fixture && Number.isFinite(Number(fixture.bitrate))) {
    dashboard.bitrate = Math.max(0, Number(fixture.bitrate));
    if (Array.isArray(fixture.bitrateHistory) && fixture.bitrateHistory.length) {
      dashboard.bitrateHistory = fixture.bitrateHistory.slice(-60).map(function (value) { return Math.max(0, Number(value) || 0); });
    } else {
      dashboard.bitrateHistory.push(Math.round(dashboard.bitrate));
      dashboard.bitrateHistory = dashboard.bitrateHistory.slice(-60);
    }
  } else {
    updateBitrate(data);
  }
  dashboard.stream.active = !!data.outputActive;
  dashboard.stream.reconnecting = !!data.outputReconnecting;
  dashboard.stream.duration = Number(data.outputDuration) || 0;
  dashboard.stream.timecode = String(data.outputTimecode || "00:00:00");
  dashboard.stream.outputBytes = Number(data.outputBytes) || 0;
  dashboard.stream.skippedFrames = Number(data.outputSkippedFrames) || 0;
  dashboard.stream.totalFrames = Number(data.outputTotalFrames) || 0;
  dashboard.stream.congestion = Number(data.outputCongestion) || 0;
}

function applyRecordData(data) {
  if (!data) return;
  dashboard.record.active = !!data.outputActive;
  dashboard.record.paused = !!data.outputPaused;
  dashboard.record.duration = Number(data.outputDuration) || 0;
  dashboard.record.timecode = String(data.outputTimecode || "00:00:00");
}

function applyStatsData(data) {
  if (!data) return;
  dashboard.stats.availableDiskSpace = data.availableDiskSpace === null || data.availableDiskSpace === undefined ? null : Number(data.availableDiskSpace);
  dashboard.stats.outputSkippedFrames = Number(data.outputSkippedFrames) || 0;
  dashboard.stats.outputTotalFrames = Number(data.outputTotalFrames) || 0;
  dashboard.stats.renderSkippedFrames = Number(data.renderSkippedFrames) || 0;
  dashboard.stats.renderTotalFrames = Number(data.renderTotalFrames) || 0;
}

function applySceneList(data) {
  if (!data) return;
  dashboard.scenes = Array.isArray(data.scenes) ? data.scenes.slice(0, 100) : dashboard.scenes;
  if (data.currentProgramSceneName !== undefined && data.currentProgramSceneName !== null) {
    dashboard.currentScene = String(data.currentProgramSceneName);
  }
}

async function refreshSceneList() {
  var result = await obsRequest("GetSceneList");
  if (result) {
    applySceneList(result);
    if (!dashboard.currentScene) {
      var current = await obsRequest("GetCurrentProgramScene");
      if (current && current.sceneName) dashboard.currentScene = String(current.sceneName);
    }
    markFresh();
  }
}

function markFresh() {
  dashboard.updatedAt = Date.now();
  dashboard.restoredFromCache = false;
  saveCache();
  renderAll();
}

async function pollStatus() {
  if (!obsIdentified) return;
  var results = await Promise.all([
    obsRequest("GetStreamStatus"),
    obsRequest("GetRecordStatus"),
    obsRequest("GetStats")
  ]);
  if (results[0]) applyStreamData(results[0]);
  if (results[1]) applyRecordData(results[1]);
  if (results[2]) applyStatsData(results[2]);
  if (results[0] || results[1] || results[2]) markFresh();
}

async function bootstrapObsState() {
  var results = await Promise.all([
    obsRequest("GetStreamStatus"),
    obsRequest("GetRecordStatus"),
    obsRequest("GetStats"),
    obsRequest("GetSceneList")
  ]);
  if (results[0]) applyStreamData(results[0]);
  if (results[1]) applyRecordData(results[1]);
  if (results[2]) applyStatsData(results[2]);
  if (results[3]) applySceneList(results[3]);
  if (!dashboard.currentScene) {
    var current = await obsRequest("GetCurrentProgramScene");
    if (current && current.sceneName) dashboard.currentScene = String(current.sceneName);
  }
  markFresh();
  stopPolling();
  obsPollTimer = setInterval(pollStatus, 1000);
  obsSceneRefreshTimer = setInterval(refreshSceneList, 15000);
}

function handleObsEvent(data) {
  if (!data) return;
  var type = String(data.eventType || "");
  var eventData = data.eventData || {};
  if (type === "CurrentProgramSceneChanged") {
    dashboard.currentScene = String(eventData.sceneName || "");
    markFresh();
  } else if (type === "SceneListChanged" || type === "SceneCreated" || type === "SceneRemoved" || type === "SceneNameChanged") {
    refreshSceneList();
  } else if (type === "StreamStateChanged") {
    dashboard.stream.active = !!eventData.outputActive;
    dashboard.stream.reconnecting = String(eventData.outputState || "").indexOf("RECONNECT") >= 0;
    if (!dashboard.stream.active) {
      lastBytes = null;
      lastBytesAt = null;
      dashboard.bitrate = 0;
    }
    markFresh();
    pollStatus();
  } else if (type === "RecordStateChanged") {
    dashboard.record.active = !!eventData.outputActive;
    dashboard.record.paused = String(eventData.outputState || "").indexOf("PAUSED") >= 0;
    markFresh();
    pollStatus();
  }
}

async function handleObsMessage(raw) {
  var message;
  try { message = JSON.parse(raw); } catch (error) { return; }
  if (!message || typeof message.op !== "number") return;
  var data = message.d || {};

  if (message.op === 0) {
    dashboard.obsVersion = String(data.obsStudioVersion || "");
    dashboard.webSocketVersion = String(data.obsWebSocketVersion || "");
    var identify = { rpcVersion: Math.min(1, Number(data.rpcVersion) || 1), eventSubscriptions: EVENT_SUBSCRIPTIONS };
    if (data.authentication) {
      try {
        identify.authentication = await buildAuthentication(readSettings().password, data.authentication);
      } catch (error) {
        dashboard.lastError = "authentication crypto failed";
        dashboard.connectionReason = "auth";
        renderAll();
        try { obsSocket.close(); } catch (closeError) { }
        return;
      }
    }
    try { obsSocket.send(JSON.stringify({ op: 1, d: identify })); } catch (error) { }
  } else if (message.op === 2) {
    obsIdentified = true;
    obsConnecting = false;
    obsReconnectAttempt = 0;
    dashboard.connected = true;
    dashboard.connectionReason = "connected";
    renderAll();
    bootstrapObsState();
  } else if (message.op === 5) {
    handleObsEvent(data);
  } else if (message.op === 7) {
    var id = String(data.requestId || "");
    var pending = obsPending[id];
    if (!pending) return;
    clearTimeout(pending.timer);
    delete obsPending[id];
    if (data.requestStatus && data.requestStatus.result) pending.resolve(data.responseData || {});
    else {
      dashboard.lastError = data.requestStatus && data.requestStatus.comment ? String(data.requestStatus.comment) : pending.type + " failed";
      pending.resolve(null);
    }
  }
}

function handleSocketClosed(event) {
  var wasIdentified = obsIdentified;
  stopPolling();
  clearPendingRequests();
  obsIdentified = false;
  obsConnecting = false;
  dashboard.connected = false;
  if (event && Number(event.code) === 4009) dashboard.connectionReason = "auth";
  else if (dashboard.connectionReason !== "auth") dashboard.connectionReason = "disconnected";
  if (wasIdentified) lastBytes = null;
  renderAll();
  scheduleReconnect();
}

function connectObs() {
  if (obsConnecting || obsIdentified) return;
  if (fixtureData()) {
    disconnectObs(false);
    obsIdentified = true;
    obsConnecting = false;
    obsReconnectAttempt = 0;
    dashboard.connected = true;
    dashboard.connectionReason = "connected";
    dashboard.obsVersion = "fixture";
    dashboard.webSocketVersion = "fixture";
    renderAll();
    bootstrapObsState();
    return;
  }
  disconnectObs(false);
  obsConnecting = true;
  dashboard.connected = false;
  dashboard.connectionReason = "connecting";
  renderAll();
  var cfg = readSettings();
  currentConnectionKey = cfg.port + "\u0000" + cfg.password;
  try {
    obsSocket = new WebSocket("ws://127.0.0.1:" + cfg.port);
  } catch (error) {
    obsConnecting = false;
    dashboard.connectionReason = "disconnected";
    renderAll();
    scheduleReconnect();
    return;
  }
  obsSocket.onopen = function () { obsConnecting = true; };
  obsSocket.onmessage = function (event) { handleObsMessage(event.data); };
  obsSocket.onerror = function () { };
  obsSocket.onclose = handleSocketClosed;
}

function cancelStreamConfirmation() {
  clearTimeout(pendingStreamTimer);
  pendingStreamTimer = null;
  pendingStreamAction = null;
  document.getElementById("streamControl").classList.remove("is-confirming");
  renderStream();
}

async function executeStreamAction(action) {
  var requestType = action === "stop" ? "StopStream" : "StartStream";
  showToast(action === "stop" ? tt("Stopping stream") : tt("Starting stream"));
  cancelStreamConfirmation();
  var result = await obsRequest(requestType);
  if (result === null) showToast(tt("Could not change stream state"));
  await pollStatus();
}

function requestStreamToggle() {
  if (!dashboard.connected) return;
  var action = dashboard.stream.active ? "stop" : "start";
  if (pendingStreamAction === action) {
    executeStreamAction(action);
    return;
  }
  cancelStreamConfirmation();
  pendingStreamAction = action;
  document.getElementById("streamControl").classList.add("is-confirming");
  setText("stateText", action === "stop" ? tt("STOP STREAM?") : tt("START STREAM?"));
  pendingStreamTimer = setTimeout(cancelStreamConfirmation, 3200);
}

async function switchScene(name) {
  if (!dashboard.connected || !name || name === dashboard.currentScene) return;
  var result = await obsRequest("SetCurrentProgramScene", { sceneName: name });
  if (result === null) {
    showToast(tt("Could not switch scene"));
    return;
  }
  dashboard.currentScene = name;
  markFresh();
  showToast(tt("Scene switched"));
}

function wireInteractions() {
  document.getElementById("streamControl").addEventListener("click", function (event) {
    event.stopPropagation();
    requestStreamToggle();
  });
  document.getElementById("sceneRail").addEventListener("click", function (event) {
    var button = event.target.closest(".scene-button");
    if (!button) return;
    switchScene(String(button.dataset.sceneName || ""));
  });
  document.getElementById("stage").addEventListener("click", function (event) {
    if (pendingStreamAction && !event.target.closest("#streamControl")) cancelStreamConfirmation();
  });
  window.addEventListener("resize", applySlot);
  window.addEventListener("beforeunload", function () { disconnectObs(false); });
}

function startWidget() {
  if (widgetStarted) return;
  widgetStarted = true;
  applySlot();
  loadCache();
  applySettings();
  wireInteractions();
  translateRuntime();
  renderAll();
  var cfg = readSettings();
  currentConnectionKey = cfg.port + "\u0000" + cfg.password;
  connectObs();
  setInterval(function () {
    if (!dashboard.connected && dashboard.updatedAt) renderConnection();
  }, 1000);
}

icueEvents = {
  onICUEInitialized: function () {
    startWidget();
    applySettings();
    translateRuntime();
  },
  onDataUpdated: function () {
    applySettings();
    translateRuntime();
  }
};

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", startWidget, { once: true });
else startWidget();
