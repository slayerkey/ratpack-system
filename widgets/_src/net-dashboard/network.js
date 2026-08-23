/* Network Dashboard for XENEON Edge.
 * HTTPS response timing is not ICMP ping. The UI labels failed attempts as probe loss
 * and never claims packet loss that the browser runtime cannot measure directly.
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
var WINDOW_MINUTES = [5, 30, 120];
var DEFAULT_WINDOW_INDEX = 1;
var MAX_HOSTS = 5;
var PRIMARY_TIMEOUT_MS = 8000;
var SECONDARY_INTERVAL_MS = 30000;
var SPEED_BYTES = 25000000;
var SPEED_TIMEOUT_MS = 30000;
var HISTORY_MARGIN_MS = 5 * 60 * 1000;

var netCopy = {};

var netState = {
  hosts: [],
  hostReadings: {},
  primaryHash: "",
  samples: [],
  windowIndex: DEFAULT_WINDOW_INDEX,
  probeTimer: null,
  probeInFlight: false,
  lastSecondaryAt: 0,
  pausedForSpeed: false,
  speedRunning: false,
  speedResult: null,
  started: false,
  translationsReady: false,
  lastConfigSignature: ""
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
  try {
    if (typeof uniqueId !== "undefined" && uniqueId) return String(uniqueId);
  } catch (error) { }
  return "packrat";
}

function storageKey(namespace) {
  return instanceId() + ":net-dashboard:" + namespace;
}

function storeRead(namespace, fallback) {
  try {
    var raw = localStorage.getItem(storageKey(namespace));
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    return fallback;
  }
}

function storeWrite(namespace, value) {
  try {
    localStorage.setItem(storageKey(namespace), JSON.stringify(value));
  } catch (error) { }
}

function fnv1a(value) {
  var text = String(value || "");
  var hash = 0x811c9dc5;
  for (var i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function hostHash(url) {
  return fnv1a(String(url || "").trim());
}

function safeHostname(url) {
  try {
    return new URL(url).hostname.replace(/^www\./i, "") || "HTTPS host";
  } catch (error) {
    return "HTTPS host";
  }
}

function parseHosts(raw) {
  var parts = String(raw || "").split(/[\n,]+/);
  var result = [];
  var seen = {};
  for (var i = 0; i < parts.length && result.length < MAX_HOSTS; i++) {
    var value = parts[i].trim();
    if (!value) continue;
    try {
      var parsed = new URL(value);
      if (parsed.protocol !== "https:") continue;
      var canonical = parsed.href;
      if (seen[canonical]) continue;
      seen[canonical] = true;
      result.push({ url: canonical, hash: hostHash(canonical), name: safeHostname(canonical) });
    } catch (error) { }
  }
  return result;
}

function readSettings() {
  var interval = Math.max(5, Math.min(60, Number(getIcueProperty("probeInterval", 10)) || 10));
  var warning = Math.max(25, Math.min(500, Number(getIcueProperty("warnAt", 100)) || 100));
  return {
    hosts: parseHosts(getIcueProperty("probeHosts", "")),
    intervalMs: interval * 1000,
    warnAt: warning,
    text: String(getIcueProperty("textColor", "#F4F6F8") || "#F4F6F8"),
    accent: String(getIcueProperty("accentColor", "#2BE86A") || "#2BE86A"),
    background: String(getIcueProperty("backgroundColor", "#07090D") || "#07090D")
  };
}

function sampleState(sample) {
  if (!sample || sample.counted === false) return "unobserved";
  return sample.ok ? "success" : "loss";
}

function computeMetrics(samples, cutoff) {
  var list = (samples || []).filter(function (sample) {
    return sample && Number(sample.t) >= cutoff && sample.counted !== false;
  }).sort(function (a, b) { return a.t - b.t; });

  var failures = 0;
  var adjacentTotal = 0;
  var adjacentCount = 0;
  for (var i = 0; i < list.length; i++) {
    if (!list[i].ok) failures++;
    if (i > 0 && list[i - 1].ok && list[i].ok) {
      adjacentTotal += Math.abs(Number(list[i].ms) - Number(list[i - 1].ms));
      adjacentCount++;
    }
  }

  var latest = list.length ? list[list.length - 1] : null;
  return {
    attempts: list.length,
    failures: failures,
    loss: list.length ? failures / list.length * 100 : null,
    jitter: adjacentCount ? adjacentTotal / adjacentCount : null,
    current: latest && latest.ok ? Number(latest.ms) : null,
    latestFailed: Boolean(latest && !latest.ok),
    adjacentPairs: adjacentCount
  };
}

function mbps(bytes, elapsedMs) {
  if (!Number.isFinite(bytes) || !Number.isFinite(elapsedMs) || elapsedMs <= 0) return null;
  return bytes * 8 / (elapsedMs / 1000) / 1000000;
}

async function readDownloadBody(response, onProgress, expectedBytes) {
  if (!response || !response.ok) throw new Error("download response failed");
  var received = 0;
  var lastPaint = 0;
  if (response.body && typeof response.body.getReader === "function") {
    var reader = response.body.getReader();
    while (true) {
      var part = await reader.read();
      if (part.done) break;
      received += part.value ? part.value.byteLength : 0;
      var now = performance.now();
      if (onProgress && now - lastPaint >= 100) {
        lastPaint = now;
        onProgress(received, expectedBytes || 0);
      }
    }
  } else {
    var buffer = await response.arrayBuffer();
    received = buffer.byteLength;
  }
  if (onProgress) onProgress(received, expectedBytes || received);
  return received;
}

function nextPaint() {
  return new Promise(function (resolve) {
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(function () { resolve(); });
    else setTimeout(resolve, 0);
  });
}

async function buildUploadBody(totalBytes, chunkBytes, yieldFn) {
  var total = Math.max(0, Number(totalBytes) || 0);
  var chunk = Math.max(65536, Number(chunkBytes) || 1048576);
  var pieces = [];
  var made = 0;
  var count = 0;
  var yieldTask = typeof yieldFn === "function" ? yieldFn : nextPaint;
  while (made < total) {
    var size = Math.min(chunk, total - made);
    pieces.push(new Uint8Array(size));
    made += size;
    count++;
    if (count % 4 === 0 && made < total) await yieldTask();
  }
  return new Blob(pieces, { type: "text/plain;charset=UTF-8" });
}

function currentWindowMinutes() {
  return WINDOW_MINUTES[netState.windowIndex] || 30;
}

function currentCutoff(now) {
  return Number(now || Date.now()) - currentWindowMinutes() * 60 * 1000;
}

function historyNamespace(hash) {
  return "history:" + String(hash || "none");
}

function loadPrimaryHistory(hash) {
  var raw = storeRead(historyNamespace(hash), []);
  if (!Array.isArray(raw)) raw = [];
  var oldest = Date.now() - (120 * 60 * 1000 + HISTORY_MARGIN_MS);
  netState.samples = raw.filter(function (sample) {
    return sample && Number(sample.t) >= oldest && (sample.ok === true || sample.ok === false);
  }).slice(-1200);
}

function savePrimaryHistory() {
  if (!netState.primaryHash) return;
  var oldest = Date.now() - (120 * 60 * 1000 + HISTORY_MARGIN_MS);
  netState.samples = netState.samples.filter(function (sample) { return sample.t >= oldest; }).slice(-1200);
  storeWrite(historyNamespace(netState.primaryHash), netState.samples);
}

function hostReadingNamespace(hash) {
  return "host:" + String(hash || "none");
}

function loadHostReading(host) {
  var saved = storeRead(hostReadingNamespace(host.hash), null);
  if (!saved || typeof saved !== "object") return { verified: false, lastMs: null, lastOkAt: 0, lastAttemptAt: 0, failed: false };
  return {
    verified: saved.verified === true,
    lastMs: Number.isFinite(Number(saved.lastMs)) ? Number(saved.lastMs) : null,
    lastOkAt: Number(saved.lastOkAt) || 0,
    lastAttemptAt: Number(saved.lastAttemptAt) || 0,
    failed: saved.failed === true
  };
}

function saveHostReading(host, reading) {
  storeWrite(hostReadingNamespace(host.hash), {
    verified: reading.verified === true,
    lastMs: reading.lastMs,
    lastOkAt: reading.lastOkAt,
    lastAttemptAt: reading.lastAttemptAt,
    failed: reading.failed === true
  });
}

function speedNamespace() {
  return "speed-result";
}

function configSignature(cfg) {
  return cfg.hosts.map(function (host) { return host.hash; }).join("|") + ":" + cfg.intervalMs + ":" + cfg.warnAt;
}

function applySettings() {
  var cfg = readSettings();
  if (typeof document !== "undefined") {
    document.documentElement.style.setProperty("--text", cfg.text);
    document.documentElement.style.setProperty("--accent", cfg.accent);
    document.documentElement.style.setProperty("--bg", cfg.background);
  }

  var signature = configSignature(cfg);
  var primary = cfg.hosts.length ? cfg.hosts[0] : null;
  var primaryChanged = (primary ? primary.hash : "") !== netState.primaryHash;
  netState.hosts = cfg.hosts;

  var nextReadings = {};
  cfg.hosts.forEach(function (host) {
    nextReadings[host.hash] = netState.hostReadings[host.hash] || loadHostReading(host);
  });
  netState.hostReadings = nextReadings;

  if (primaryChanged) {
    netState.primaryHash = primary ? primary.hash : "";
    if (primary) loadPrimaryHistory(primary.hash);
    else netState.samples = [];
  }

  if (signature !== netState.lastConfigSignature) {
    netState.lastConfigSignature = signature;
    scheduleProbe(true);
  }
  renderAll();
}

function cacheBusted(url) {
  var parsed = new URL(url);
  parsed.searchParams.set("_packrat_probe", String(Date.now()));
  return parsed.href;
}

async function fetchWithTimeout(url, options, timeoutMs) {
  var controller = new AbortController();
  var timer = setTimeout(function () { controller.abort(); }, timeoutMs);
  var merged = Object.assign({}, options || {}, { signal: controller.signal });
  try {
    return await fetch(url, merged);
  } finally {
    clearTimeout(timer);
  }
}

async function probeHost(host) {
  var start = performance.now();
  try {
    var response = await fetchWithTimeout(cacheBusted(host.url), { method: "GET", cache: "no-store", mode: "cors" }, PRIMARY_TIMEOUT_MS);
    var elapsed = performance.now() - start;
    if (!response || !response.ok) return { ok: false, ms: null, status: response ? response.status : 0 };
    try { if (response.body && typeof response.body.cancel === "function") response.body.cancel(); } catch (error) { }
    return { ok: true, ms: elapsed, status: response.status };
  } catch (error) {
    return { ok: false, ms: null, status: 0 };
  }
}

function recordHostAttempt(host, result, isPrimary) {
  var reading = netState.hostReadings[host.hash] || loadHostReading(host);
  var wasVerified = reading.verified === true;
  reading.lastAttemptAt = Date.now();
  reading.failed = !result.ok;
  if (result.ok) {
    reading.verified = true;
    reading.lastMs = Math.max(0, Number(result.ms) || 0);
    reading.lastOkAt = reading.lastAttemptAt;
  }
  netState.hostReadings[host.hash] = reading;
  saveHostReading(host, reading);

  if (isPrimary) {
    var counted = result.ok || wasVerified;
    netState.samples.push({
      t: reading.lastAttemptAt,
      ok: result.ok === true,
      ms: result.ok ? Math.max(0, Number(result.ms) || 0) : null,
      counted: counted
    });
    savePrimaryHistory();
  }
}

async function runProbeCycle(forceSecondary) {
  if (netState.pausedForSpeed || netState.probeInFlight || !netState.hosts.length) return;
  netState.probeInFlight = true;
  var now = Date.now();
  var doSecondary = Boolean(forceSecondary || now - netState.lastSecondaryAt >= SECONDARY_INTERVAL_MS);
  try {
    var primary = netState.hosts[0];
    var primaryResult = await probeHost(primary);
    recordHostAttempt(primary, primaryResult, true);

    if (doSecondary && netState.hosts.length > 1 && !netState.pausedForSpeed) {
      netState.lastSecondaryAt = Date.now();
      var secondary = netState.hosts.slice(1);
      var results = await Promise.all(secondary.map(function (host) { return probeHost(host); }));
      for (var i = 0; i < secondary.length; i++) recordHostAttempt(secondary[i], results[i], false);
    }
  } finally {
    netState.probeInFlight = false;
    renderAll();
    scheduleProbe(false);
  }
}

function scheduleProbe(immediate) {
  if (typeof window === "undefined") return;
  if (netState.probeTimer) clearTimeout(netState.probeTimer);
  netState.probeTimer = null;
  if (!netState.started || netState.pausedForSpeed || !netState.hosts.length) return;
  var delay = immediate ? 80 : readSettings().intervalMs;
  netState.probeTimer = setTimeout(function () { runProbeCycle(false); }, delay);
}

function statusBand(ms, warnAt) {
  if (!Number.isFinite(Number(ms))) return "check";
  var value = Number(ms);
  if (value < warnAt) return "good";
  if (value <= warnAt * 1.75) return "warn";
  return "bad";
}

function nearestSlot() {
  if (typeof window === "undefined") return "s-h";
  var w = Math.max(1, window.innerWidth || 840);
  var h = Math.max(1, window.innerHeight || 344);
  var best = SLOT_SPECS[0];
  var score = Infinity;
  for (var i = 0; i < SLOT_SPECS.length; i++) {
    var spec = SLOT_SPECS[i];
    var next = Math.abs(Math.log(w / spec.w)) + Math.abs(Math.log(h / spec.h));
    if (next < score) { score = next; best = spec; }
  }
  return best.id;
}

function applySlot() {
  if (typeof document === "undefined") return;
  document.body.setAttribute("data-slot", nearestSlot());
  requestAnimationFrame(drawRibbon);
}

function setText(id, value) {
  if (typeof document === "undefined") return;
  var node = document.getElementById(id);
  if (node) node.textContent = String(value == null ? "" : value);
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

function copy(key) {
  return netCopy[key] || key;
}

async function translateRuntime() {
  if (typeof document === "undefined") return;
  var keys = [
    "PING", "JITTER", "PROBE LOSS", "LATENCY HISTORY", "Healthy", "Warning", "High",
    "Probe loss", "Unobserved", "MONITORED HOSTS", "THROUGHPUT", "Network Dashboard",
    "Latency history. Tap to change time window.", "Monitored hosts", "Run throughput test",
    "Monitoring starts with the first verified probe", "Add at least one HTTPS probe host in settings.",
    "No primary host configured", "Waiting for monitoring", "Add an HTTPS probe host in settings",
    "Waiting for a verified response", "No valid adjacent pair yet", "Unverified failures are not counted",
    "Checking primary host", "Last good", "No recent good value", "valid pairs", "verified attempts",
    "Latest primary probe failed", "HTTPS response latency", "adjacent pairs", "Connection quality is degraded",
    "Monitoring normally", "CHECK HOST", "FAILED", "last good", "LIVE", "updated",
    "Tap to retest with Cloudflare", "Tap to test with Cloudflare", "NEVER", "TESTING",
    "Preparing", "Testing download", "Download complete", "Preparing upload", "Testing upload",
    "Test complete", "Test failed • showing last complete result", "Test failed • tap to retry",
    "Primary host"
  ];
  var translated = await Promise.all(keys.map(function (key) { return t(key); }));
  keys.forEach(function (key, index) { netCopy[key] = translated[index]; });
  var pairs = {
    pingLabel: "PING",
    jitterLabel: "JITTER",
    lossLabel: "PROBE LOSS",
    ribbonEyebrow: "LATENCY HISTORY",
    legendGood: "Healthy",
    legendWarn: "Warning",
    legendBad: "High",
    legendLoss: "Probe loss",
    legendUnobserved: "Unobserved",
    hostsTitle: "MONITORED HOSTS",
    speedTitle: "THROUGHPUT"
  };
  var ids = Object.keys(pairs);
  ids.forEach(function (id) { setText(id, copy(pairs[id])); });
  setText("ribbonEmpty", copy("Monitoring starts with the first verified probe"));
  setText("hostsEmpty", copy("Add at least one HTTPS probe host in settings."));
  document.getElementById("stage").setAttribute("aria-label", copy("Network Dashboard"));
  document.getElementById("ribbonPanel").setAttribute("aria-label", copy("Latency history. Tap to change time window."));
  document.getElementById("hostsPanel").setAttribute("aria-label", copy("Monitored hosts"));
  document.getElementById("speedPanel").setAttribute("aria-label", copy("Run throughput test"));
  netState.translationsReady = true;
  renderAll();
}

function formatMetric(value, digits) {
  if (value === null || value === undefined || value === "" || !Number.isFinite(Number(value))) return "--";
  var number = Number(value);
  if (digits === 1) return number.toFixed(1);
  return String(Math.round(number));
}

function timeAgo(timestamp) {
  var ms = Date.now() - Number(timestamp || 0);
  if (!timestamp) return "";
  if (ms < 60000) return "<1m";
  if (ms < 3600000) return Math.floor(ms / 60000) + "m";
  return Math.floor(ms / 3600000) + "h";
}

function primaryHost() {
  return netState.hosts.length ? netState.hosts[0] : null;
}

function primaryReading() {
  var host = primaryHost();
  return host ? netState.hostReadings[host.hash] : null;
}

function derivePanelState(metrics, reading) {
  if (!netState.hosts.length) return "unconfigured";
  if (!reading || !reading.verified) return "fresh";
  if (metrics.latestFailed) return "offline";
  if ((metrics.loss || 0) > 0 || (metrics.jitter || 0) >= readSettings().warnAt * 0.35) return "degraded";
  return "live";
}

function renderMetrics() {
  if (typeof document === "undefined") return;
  var metrics = computeMetrics(netState.samples, currentCutoff(Date.now()));
  var reading = primaryReading();
  var panelState = derivePanelState(metrics, reading);
  document.body.setAttribute("data-state", panelState);

  setText("pingValue", formatMetric(metrics.current, 0));
  setText("jitterValue", formatMetric(metrics.jitter, 1));
  setText("lossValue", formatMetric(metrics.loss, 1));

  if (!netState.hosts.length) {
    setText("pingFoot", copy("No primary host configured"));
    setText("jitterFoot", copy("Waiting for monitoring"));
    setText("lossFoot", copy("Waiting for monitoring"));
    setText("statusText", copy("Add an HTTPS probe host in settings"));
  } else if (!reading || !reading.verified) {
    setText("pingFoot", copy("Waiting for a verified response"));
    setText("jitterFoot", copy("No valid adjacent pair yet"));
    setText("lossFoot", copy("Unverified failures are not counted"));
    setText("statusText", copy("Checking primary host"));
  } else if (metrics.latestFailed) {
    setText("pingFoot", Number.isFinite(reading.lastMs) ? copy("Last good") + " " + Math.round(reading.lastMs) + " ms" : copy("No recent good value"));
    setText("jitterFoot", metrics.adjacentPairs ? metrics.adjacentPairs + " " + copy("valid pairs") : copy("No valid adjacent pair yet"));
    setText("lossFoot", metrics.attempts + " " + copy("verified attempts"));
    setText("statusText", copy("Latest primary probe failed"));
  } else {
    setText("pingFoot", copy("HTTPS response latency"));
    setText("jitterFoot", metrics.adjacentPairs ? metrics.adjacentPairs + " " + copy("adjacent pairs") : copy("No valid adjacent pair yet"));
    setText("lossFoot", metrics.attempts + " " + copy("verified attempts"));
    setText("statusText", panelState === "degraded" ? copy("Connection quality is degraded") : copy("Monitoring normally"));
  }
}

function renderHosts() {
  if (typeof document === "undefined") return;
  var list = document.getElementById("hostsList");
  var panel = document.getElementById("hostsPanel");
  if (!list || !panel) return;
  list.replaceChildren();
  panel.classList.toggle("is-empty", netState.hosts.length === 0);
  setText("hostsCount", netState.hosts.length + "/5");
  setText("primaryHost", netState.hosts.length ? netState.hosts[0].name : copy("Primary host"));
  var cfg = readSettings();

  netState.hosts.forEach(function (host, index) {
    var reading = netState.hostReadings[host.hash] || loadHostReading(host);
    var row = document.createElement("div");
    row.className = "host-row";
    var dot = document.createElement("span");
    var band = !reading.verified ? "check" : (reading.failed ? "bad" : statusBand(reading.lastMs, cfg.warnAt));
    dot.className = "host-dot " + band;
    var details = document.createElement("div");
    var name = document.createElement("div");
    name.className = "host-name";
    name.textContent = (index === 0 ? "★ " : "") + host.name;
    var sub = document.createElement("div");
    sub.className = "host-sub";
    if (!reading.verified) sub.textContent = copy("CHECK HOST");
    else if (reading.failed) sub.textContent = copy("FAILED") + " • " + copy("last good") + " " + timeAgo(reading.lastOkAt);
    else sub.textContent = copy("LIVE") + " • " + copy("updated") + " " + timeAgo(reading.lastAttemptAt);
    details.appendChild(name);
    details.appendChild(sub);
    var value = document.createElement("div");
    value.className = "host-ms";
    if (reading.verified && !reading.failed && Number.isFinite(reading.lastMs)) {
      value.textContent = String(Math.round(reading.lastMs));
      var unit = document.createElement("small");
      unit.textContent = " ms";
      value.appendChild(unit);
    } else {
      value.textContent = "--";
    }
    row.appendChild(dot);
    row.appendChild(details);
    row.appendChild(value);
    list.appendChild(row);
  });
}

function renderSpeed() {
  if (typeof document === "undefined") return;
  var result = netState.speedResult;
  if (result && Number.isFinite(result.down) && Number.isFinite(result.up)) {
    setText("downValue", result.down >= 100 ? Math.round(result.down) : result.down.toFixed(1));
    setText("upValue", result.up >= 100 ? Math.round(result.up) : result.up.toFixed(1));
    setText("speedStamp", timeAgo(result.at).toUpperCase());
    if (!netState.speedRunning) setText("speedStatus", copy("Tap to retest with Cloudflare"));
  } else {
    setText("downValue", "--");
    setText("upValue", "--");
    setText("speedStamp", copy("NEVER"));
    if (!netState.speedRunning) setText("speedStatus", copy("Tap to test with Cloudflare"));
  }
}

function fitCanvas(canvas) {
  if (!canvas) return null;
  var rect = canvas.getBoundingClientRect();
  var dpr = Math.min(2, window.devicePixelRatio || 1);
  var width = Math.max(1, Math.round(rect.width * dpr));
  var height = Math.max(1, Math.round(rect.height * dpr));
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  return { width: width, height: height, dpr: dpr };
}

function cssColor(name, fallback) {
  try {
    var value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || fallback;
  } catch (error) {
    return fallback;
  }
}

function visualBuckets(samples, startTime, endTime, width) {
  var columns = Math.max(1, Math.min(Math.floor(width), 900));
  var buckets = new Array(columns);
  for (var i = 0; i < columns; i++) buckets[i] = { success: [], hasLoss: false, hasObserved: false };
  var span = Math.max(1, endTime - startTime);
  (samples || []).forEach(function (sample) {
    if (!sample || sample.t < startTime || sample.t > endTime) return;
    var state = sampleState(sample);
    if (state === "unobserved") return;
    var index = Math.max(0, Math.min(columns - 1, Math.floor((sample.t - startTime) / span * columns)));
    buckets[index].hasObserved = true;
    if (state === "loss") buckets[index].hasLoss = true;
    else if (Number.isFinite(Number(sample.ms))) buckets[index].success.push(Number(sample.ms));
  });
  return buckets;
}

function drawRibbon() {
  if (typeof document === "undefined") return;
  var canvas = document.getElementById("latencyRibbon");
  if (!canvas) return;
  var fit = fitCanvas(canvas);
  if (!fit) return;
  var ctx = canvas.getContext("2d");
  var w = fit.width;
  var h = fit.height;
  var now = Date.now();
  var start = currentCutoff(now);
  var cfg = readSettings();
  var accent = cssColor("--accent", "#2BE86A");
  var warn = cssColor("--warn", "#FFB44A");
  var bad = cssColor("--bad", "#FF5A64");
  ctx.clearRect(0, 0, w, h);

  ctx.fillStyle = "rgba(255,255,255,0.035)";
  var dotGap = Math.max(12, Math.round(18 * fit.dpr));
  for (var gx = dotGap / 2; gx < w; gx += dotGap) {
    for (var gy = dotGap / 2; gy < h; gy += dotGap) {
      ctx.fillRect(Math.round(gx), Math.round(gy), Math.max(1, fit.dpr), Math.max(1, fit.dpr));
    }
  }

  var recent = netState.samples.filter(function (sample) { return sample.t >= start; });
  if (!recent.length) return;
  var successful = recent.filter(function (sample) { return sample.ok && sample.counted !== false && Number.isFinite(Number(sample.ms)); });
  var observedMax = successful.length ? Math.max.apply(null, successful.map(function (sample) { return Number(sample.ms); })) : cfg.warnAt * 2;
  var scaleMax = Math.max(cfg.warnAt * 2.2, Math.min(observedMax * 1.08, cfg.warnAt * 8));
  var buckets = visualBuckets(recent, start, now, Math.max(1, w / fit.dpr));
  var columnW = w / buckets.length;
  var baselineY = h - Math.max(5, Math.round(7 * fit.dpr));

  buckets.forEach(function (bucket, index) {
    if (!bucket.hasObserved) return;
    var x = index * columnW;
    if (bucket.hasLoss) {
      ctx.clearRect(x, 0, Math.max(columnW, fit.dpr * 1.6), h);
      ctx.fillStyle = "rgba(0,0,0,0.72)";
      ctx.fillRect(x, 0, Math.max(columnW, fit.dpr * 1.6), h);
      return;
    }
    if (!bucket.success.length) return;
    var value = bucket.success.reduce(function (sum, item) { return sum + item; }, 0) / bucket.success.length;
    var capped = Math.min(value, scaleMax);
    var barH = Math.max(3 * fit.dpr, (h - 14 * fit.dpr) * (capped / scaleMax));
    var color = value < cfg.warnAt ? accent : (value <= cfg.warnAt * 1.75 ? warn : bad);
    ctx.fillStyle = color;
    var barW = Math.max(fit.dpr, columnW * 0.76);
    ctx.fillRect(x + (columnW - barW) / 2, baselineY - barH, barW, barH);
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fillRect(x, baselineY, Math.max(columnW, fit.dpr), Math.max(1, fit.dpr));
    if (value > scaleMax) {
      ctx.fillStyle = bad;
      ctx.fillRect(x + (columnW - barW) / 2, 2 * fit.dpr, barW, 2 * fit.dpr);
    }
  });
}

function renderAll() {
  if (typeof document === "undefined") return;
  renderMetrics();
  renderHosts();
  renderSpeed();
  setText("windowBadge", currentWindowMinutes() + " MIN");
  requestAnimationFrame(drawRibbon);
}

function cycleWindow() {
  netState.windowIndex = (netState.windowIndex + 1) % WINDOW_MINUTES.length;
  storeWrite("window-index", netState.windowIndex);
  renderAll();
}

function setSpeedPhase(text, progress) {
  if (typeof document === "undefined") return;
  setText("speedStatus", text);
  setText("speedStamp", copy("TESTING"));
  var fill = document.getElementById("speedProgressFill");
  if (fill) fill.style.width = Math.max(0, Math.min(100, Number(progress) || 0)) + "%";
}

async function warmCloudflare() {
  try {
    await fetchWithTimeout("https://speed.cloudflare.com/__down?bytes=100000&_packrat_warm=" + Date.now(), { cache: "no-store", mode: "cors" }, 10000);
  } catch (error) { }
}

async function measureDownload() {
  var url = "https://speed.cloudflare.com/__down?bytes=" + SPEED_BYTES + "&_packrat_speed=" + Date.now();
  var start = performance.now();
  var response = await fetchWithTimeout(url, { cache: "no-store", mode: "cors" }, SPEED_TIMEOUT_MS);
  var bytes = await readDownloadBody(response, function (received, expected) {
    var ratio = expected > 0 ? received / expected : 0;
    setSpeedPhase(copy("Testing download"), Math.min(48, ratio * 48));
  }, SPEED_BYTES);
  var elapsed = performance.now() - start;
  var speed = mbps(bytes, elapsed);
  if (!Number.isFinite(speed) || bytes < SPEED_BYTES * 0.9) throw new Error("download incomplete");
  return speed;
}

async function measureUpload() {
  setSpeedPhase(copy("Preparing upload"), 52);
  var body = await buildUploadBody(SPEED_BYTES, 1048576, async function () {
    var fill = document.getElementById("speedProgressFill");
    if (fill) {
      var current = parseFloat(fill.style.width) || 52;
      fill.style.width = Math.min(60, current + 1) + "%";
    }
    await nextPaint();
  });
  setSpeedPhase(copy("Testing upload"), 66);
  var start = performance.now();
  var response = await fetchWithTimeout("https://speed.cloudflare.com/__up?_packrat_speed=" + Date.now(), {
    method: "POST",
    body: body,
    cache: "no-store",
    mode: "cors"
  }, SPEED_TIMEOUT_MS);
  var elapsed = performance.now() - start;
  if (!response || !response.ok) throw new Error("upload response failed");
  var speed = mbps(SPEED_BYTES, elapsed);
  if (!Number.isFinite(speed)) throw new Error("upload timing failed");
  return speed;
}

async function runSpeedTest() {
  if (netState.speedRunning) return;
  netState.speedRunning = true;
  netState.pausedForSpeed = true;
  if (netState.probeTimer) clearTimeout(netState.probeTimer);
  netState.probeTimer = null;
  if (typeof document !== "undefined") document.body.classList.add("speed-running");
  setSpeedPhase(copy("Preparing"), 4);

  try {
    await nextPaint();
    await warmCloudflare();
    setSpeedPhase(copy("Testing download"), 8);
    var down = await measureDownload();
    setSpeedPhase(copy("Download complete"), 50);
    await nextPaint();
    var up = await measureUpload();
    netState.speedResult = { down: down, up: up, at: Date.now() };
    storeWrite(speedNamespace(), netState.speedResult);
    setSpeedPhase(copy("Test complete"), 100);
    renderSpeed();
  } catch (error) {
    setSpeedPhase(netState.speedResult ? copy("Test failed • showing last complete result") : copy("Test failed • tap to retry"), 0);
    renderSpeed();
  } finally {
    await new Promise(function (resolve) { setTimeout(resolve, 500); });
    netState.speedRunning = false;
    netState.pausedForSpeed = false;
    if (typeof document !== "undefined") document.body.classList.remove("speed-running");
    var fill = typeof document !== "undefined" ? document.getElementById("speedProgressFill") : null;
    if (fill) fill.style.width = "0%";
    renderSpeed();
    scheduleProbe(true);
  }
}

function activateOnKey(event, action) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    action();
  }
}

function bindInteractions() {
  var ribbon = document.getElementById("ribbonPanel");
  var speed = document.getElementById("speedPanel");
  ribbon.addEventListener("click", cycleWindow);
  ribbon.addEventListener("keydown", function (event) { activateOnKey(event, cycleWindow); });
  speed.addEventListener("click", runSpeedTest);
  speed.addEventListener("keydown", function (event) { activateOnKey(event, runSpeedTest); });
}

function startWidget() {
  if (netState.started || typeof document === "undefined") return;
  netState.started = true;
  var savedWindow = Number(storeRead("window-index", DEFAULT_WINDOW_INDEX));
  if (Number.isInteger(savedWindow) && savedWindow >= 0 && savedWindow < WINDOW_MINUTES.length) netState.windowIndex = savedWindow;
  var savedSpeed = storeRead(speedNamespace(), null);
  if (savedSpeed && Number.isFinite(Number(savedSpeed.down)) && Number.isFinite(Number(savedSpeed.up))) {
    netState.speedResult = { down: Number(savedSpeed.down), up: Number(savedSpeed.up), at: Number(savedSpeed.at) || 0 };
  }
  applySlot();
  bindInteractions();
  applySettings();
  translateRuntime();
  window.addEventListener("resize", function () { applySlot(); renderAll(); });
  scheduleProbe(true);
}

icueEvents = {
  onICUEInitialized: function () {
    startWidget();
    applySettings();
    translateRuntime();
  },
  onDataUpdated: function () {
    applySettings();
  }
};

if (typeof globalThis !== "undefined") {
  globalThis.__netDashboardTest = {
    fnv1a: fnv1a,
    hostHash: hostHash,
    parseHosts: parseHosts,
    sampleState: sampleState,
    computeMetrics: computeMetrics,
    mbps: mbps,
    visualBuckets: visualBuckets,
    readDownloadBody: readDownloadBody,
    buildUploadBody: buildUploadBody
  };
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", startWidget);
  else startWidget();
}
