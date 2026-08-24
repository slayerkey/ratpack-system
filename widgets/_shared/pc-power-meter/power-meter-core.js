/* PackRat PC Power Meter shared runtime.
 * The selected iCUE power sensor is always the measurement source. The widget
 * never manufactures whole-PC power by summing unrelated sensors.
 */
(function () {
  "use strict";

  var config = globalThis.PACKRAT_POWER_METER || { edition: "lite", slug: "pc-power-meter", sensorProperty: "powerSensor" };
  var math = globalThis.PackRatPowerMath;
  if (!math) throw new Error("PackRatPowerMath is required");

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

  var POLL_MS = 1000;
  var MAX_INTEGRATION_GAP_MS = 5000;
  var SESSION_RESUME_MS = 30 * 60 * 1000;
  var HISTORY_LIMIT = 24;
  var sensorRequestId = 4000;
  var sensorPending = {};
  var asyncPlugin = null;
  var eventsPlugin = null;
  var catalogue = {};
  var tracked = {};
  var graphSeries = {};
  var primary = null;
  var currentW = null;
  var lastSample = null;
  var session = null;
  var pollTimer = null;
  var scanTimer = null;
  var reconcileTimer = null;
  var scanning = false;
  var infoOpen = false;
  var demoPhase = 0;

  function byId(id) { return document.getElementById(id); }
  function setText(id, value) { var el = byId(id); if (el) el.textContent = value; }
  function setHidden(id, hidden) { var el = byId(id); if (el) el.hidden = !!hidden; }

  function getIcueProperty(name, fallback) {
    try {
      var value = globalThis[name];
      if (typeof Node !== "undefined" && value instanceof Node) return fallback;
      if (value === undefined || value === null) return fallback;
      return value;
    } catch (e) { return fallback; }
  }

  function isPreview() {
    try { return !!(globalThis.iCUE && globalThis.iCUE.isPreview); }
    catch (e) { return false; }
  }

  function instanceKey(namespace) {
    var id = "packrat";
    try { if (typeof uniqueId !== "undefined" && uniqueId) id = String(uniqueId); } catch (e) { }
    return id + ":" + config.slug + ":" + namespace;
  }

  function storeRead(namespace, fallback) {
    try {
      var raw = localStorage.getItem(instanceKey(namespace));
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }

  function storeWrite(namespace, value) {
    try {
      if (value === null) localStorage.removeItem(instanceKey(namespace));
      else localStorage.setItem(instanceKey(namespace), JSON.stringify(value));
    } catch (e) { }
  }

  function nearestSlot() {
    var w = Math.max(1, window.innerWidth || document.documentElement.clientWidth || 840);
    var h = Math.max(1, window.innerHeight || document.documentElement.clientHeight || 344);
    var best = SLOT_SPECS[0];
    var score = Infinity;
    SLOT_SPECS.forEach(function (slot) {
      var next = Math.abs(Math.log(w / slot.w)) + Math.abs(Math.log(h / slot.h));
      if (next < score) { score = next; best = slot; }
    });
    return best.id;
  }

  function applySlot() {
    document.body.setAttribute("data-slot", nearestSlot());
  }

  function sensorPlugin() {
    try { return window.plugins && window.plugins.Sensorsdataprovider; }
    catch (e) { return null; }
  }

  function connectAsync(plugin) {
    if (!plugin) return false;
    if (asyncPlugin === plugin) return true;
    if (!plugin.asyncResponse || typeof plugin.asyncResponse.connect !== "function") return false;
    try {
      plugin.asyncResponse.connect(function (requestId, value) {
        var pending = sensorPending[requestId];
        if (!pending) return;
        clearTimeout(pending.timer);
        delete sensorPending[requestId];
        pending.resolve(value);
      });
      asyncPlugin = plugin;
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
    clearTimeout(scanTimer);
    scanTimer = setTimeout(scanSensors, delay == null ? 120 : delay);
  }

  function connectSensorEvents(plugin) {
    if (!plugin || eventsPlugin === plugin) return;
    try {
      if (plugin.sensorAdded && typeof plugin.sensorAdded.connect === "function") plugin.sensorAdded.connect(function () { scheduleScan(80); });
      if (plugin.sensorRemoved && typeof plugin.sensorRemoved.connect === "function") plugin.sensorRemoved.connect(function (id) {
        if (tracked[String(id)]) breakContinuity();
        scheduleScan(80);
      });
      if (plugin.sensorDataChanged && typeof plugin.sensorDataChanged.connect === "function") plugin.sensorDataChanged.connect(function () { scheduleScan(120); });
      if (plugin.sensorUnitsChanged && typeof plugin.sensorUnitsChanged.connect === "function") plugin.sensorUnitsChanged.connect(function () { scheduleScan(120); });
      if (plugin.sensorValueChanged && typeof plugin.sensorValueChanged.connect === "function") {
        plugin.sensorValueChanged.connect(function (sensorId, value) {
          var id = String(sensorId);
          if (!tracked[id] || !catalogue[id]) return;
          consumeReading(id, value, Date.now());
        });
      }
      eventsPlugin = plugin;
    } catch (e) { }
  }

  function sensorDisplayName(sensor) {
    if (!sensor) return "Power sensor";
    var device = String(sensor.deviceName || "").trim();
    var name = String(sensor.sensorName || "").trim();
    if (device && name && device.toLowerCase() !== name.toLowerCase()) return device + " • " + name;
    return device || name || "Power sensor";
  }

  function scopeLabel(sensor) {
    if (!sensor) return "SELECTED POWER SENSOR • MEASURED";
    var kind = String(sensor.kind || "").toLowerCase();
    var haystack = (String(sensor.deviceName || "") + " " + String(sensor.sensorName || "")).toLowerCase();
    if (kind === "total-power-draw") return "TOTAL POWER DRAW • MEASURED";
    if (kind === "power-in") return "PSU INPUT POWER • MEASURED";
    if (kind === "power-out") return "PSU OUTPUT POWER • MEASURED";
    if (kind === "package") return "CPU PACKAGE POWER • MEASURED";
    if (/gpu|graphics|geforce|radeon/.test(haystack)) return "GPU POWER SENSOR • MEASURED";
    return "SELECTED POWER SENSOR • MEASURED";
  }

  function scopeExplanation(sensor) {
    if (!sensor) return "Metrics are calculated only from the selected iCUE power sensor.";
    var kind = String(sensor.kind || "").toLowerCase();
    if (kind === "total-power-draw") return "iCUE identifies this as a total power draw sensor. The widget uses that measured sensor directly.";
    if (kind === "power-in") return "This is PSU input power reported by compatible hardware. It is not relabeled from CPU or GPU data.";
    if (kind === "power-out") return "This is PSU output power reported by compatible hardware. PSU conversion losses are outside this reading.";
    if (kind === "package") return "This is CPU package power, not total PC power. Session energy and averages refer only to this sensor.";
    return "Session energy, average and peak refer only to this selected iCUE power sensor. The widget does not pretend it is whole-PC draw.";
  }

  async function inspectSensor(sensorId) {
    var id = String(sensorId);
    var result = await Promise.all([
      ask("sensorIsConnected", [id]),
      ask("getSensorType", [id]),
      ask("getSensorKind", [id]),
      ask("getSensorDeviceName", [id]),
      ask("getSensorName", [id]),
      ask("getSensorUnits", [id])
    ]);
    return {
      id: id,
      connected: result[0] !== false,
      type: String(result[1] || "").trim().toLowerCase(),
      kind: String(result[2] || "").trim().toLowerCase(),
      deviceName: String(result[3] || "").trim(),
      sensorName: String(result[4] || "").trim(),
      units: String(result[5] || "").trim()
    };
  }

  function normalizeComparisonSetting(value) {
    if (!Array.isArray(value)) return [];
    return value.map(function (item) {
      if (typeof item === "string") return { sensorId: item, color: "" };
      if (!item || !item.sensorId) return null;
      return { sensorId: String(item.sensorId), color: String(item.color || "") };
    }).filter(Boolean);
  }

  function selectedPrimaryId() {
    var value = getIcueProperty(config.sensorProperty, "");
    return typeof value === "string" ? value.trim() : "";
  }

  function comparisonSettings() {
    if (!config.comparisonProperty) return [];
    return normalizeComparisonSetting(getIcueProperty(config.comparisonProperty, []));
  }

  async function discoverCatalogue() {
    var ids = await ask("getAllSensorIds", []);
    if (!Array.isArray(ids)) return null;
    var types = await Promise.all(ids.map(function (id) { return ask("getSensorType", [String(id)]); }));
    var powerIds = [];
    ids.forEach(function (id, index) {
      if (String(types[index] || "").trim().toLowerCase() === "power") powerIds.push(String(id));
    });
    var inspected = await Promise.all(powerIds.map(inspectSensor));
    var next = {};
    inspected.forEach(function (sensor) { if (sensor && sensor.connected) next[sensor.id] = sensor; });

    var byLabel = {};
    Object.keys(next).forEach(function (id) {
      var label = sensorDisplayName(next[id]);
      if (!byLabel[label]) byLabel[label] = [];
      byLabel[label].push(id);
    });
    Object.keys(byLabel).forEach(function (label) {
      byLabel[label].sort();
      byLabel[label].forEach(function (id, index) {
        next[id].displayName = label + (byLabel[label].length > 1 ? " #" + (index + 1) : "");
      });
    });
    catalogue = next;
    return next;
  }

  function newSession(sensorId, now) {
    return {
      sensorId: String(sensorId || ""),
      startedAt: now || Date.now(),
      lastSeenAt: 0,
      energyWh: 0,
      measuredMs: 0,
      peakW: null,
      samples: 0
    };
  }

  function archiveSession(snapshot) {
    if (!config.history || !snapshot || !snapshot.sensorId || !snapshot.samples) return;
    var history = storeRead("history", []);
    if (!Array.isArray(history)) history = [];
    history.unshift({
      sensorId: snapshot.sensorId,
      startedAt: snapshot.startedAt,
      endedAt: snapshot.lastSeenAt,
      energyWh: snapshot.energyWh,
      measuredMs: snapshot.measuredMs,
      averageW: math.averageWatts(snapshot.energyWh, snapshot.measuredMs),
      peakW: snapshot.peakW
    });
    storeWrite("history", history.slice(0, HISTORY_LIMIT));
  }

  function loadSession(sensorId) {
    var now = Date.now();
    var saved = storeRead("session", null);
    if (saved && saved.sensorId === sensorId && Number(saved.lastSeenAt) > 0 && now - Number(saved.lastSeenAt) <= SESSION_RESUME_MS) {
      session = {
        sensorId: sensorId,
        startedAt: Number(saved.startedAt) || now,
        lastSeenAt: Number(saved.lastSeenAt) || 0,
        energyWh: Math.max(0, Number(saved.energyWh) || 0),
        measuredMs: Math.max(0, Number(saved.measuredMs) || 0),
        peakW: Number.isFinite(Number(saved.peakW)) ? Number(saved.peakW) : null,
        samples: Math.max(0, Number(saved.samples) || 0)
      };
    } else {
      if (saved && saved.sensorId && saved.samples) archiveSession(saved);
      session = newSession(sensorId, now);
    }
    // Never bridge an iCUE/widget restart. Totals can resume, continuity cannot.
    lastSample = null;
  }

  function persistSession() {
    if (!session) return;
    storeWrite("session", session);
  }

  function resetSession() {
    if (session && session.samples) archiveSession(session);
    session = newSession(primary ? primary.id : "", Date.now());
    lastSample = null;
    graphSeries = {};
    currentW = null;
    storeWrite("session", session);
    renderAll();
  }

  function breakContinuity() {
    lastSample = null;
    currentW = null;
    if (primary) document.body.setAttribute("data-live", "stale");
    renderMetrics();
  }

  function dayKey(timestamp) {
    var date = new Date(timestamp);
    var y = date.getFullYear();
    var m = String(date.getMonth() + 1).padStart(2, "0");
    var d = String(date.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + d;
  }

  function midnightBoundaries(t0, t1) {
    var boundaries = [];
    var start = new Date(t0);
    var next = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1).getTime();
    while (next > t0 && next < t1 && boundaries.length < 2) {
      boundaries.push(next);
      var date = new Date(next);
      next = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime();
    }
    return boundaries;
  }

  function addDailyPiece(piece) {
    if (!config.daily || !piece || !(piece.ms > 0)) return;
    var daily = storeRead("daily", {});
    if (!daily || typeof daily !== "object" || Array.isArray(daily)) daily = {};
    var key = dayKey(piece.t0 + 1);
    if (!daily[key]) daily[key] = { wh: 0, measuredMs: 0 };
    daily[key].wh += piece.wh;
    daily[key].measuredMs += piece.ms;
    var keys = Object.keys(daily).sort();
    while (keys.length > 31) delete daily[keys.shift()];
    storeWrite("daily", daily);
  }

  function graphWindowMs() {
    var seconds = Number(getIcueProperty("graphWindow", config.edition === "pro" ? 180 : 60));
    if (!Number.isFinite(seconds)) seconds = config.edition === "pro" ? 180 : 60;
    return Math.max(30, Math.min(600, seconds)) * 1000;
  }

  function pushGraphSample(sensorId, watts, timestamp) {
    var id = String(sensorId);
    if (!graphSeries[id]) graphSeries[id] = [];
    graphSeries[id].push({ t: timestamp, w: watts });
    var cutoff = timestamp - graphWindowMs() - 5000;
    graphSeries[id] = graphSeries[id].filter(function (sample) { return sample.t >= cutoff; }).slice(-700);
  }

  function consumePrimary(watts, timestamp) {
    if (!session || !primary || session.sensorId !== primary.id) loadSession(primary.id);
    currentW = watts;
    session.samples += 1;
    session.lastSeenAt = timestamp;
    session.peakW = session.peakW === null ? watts : Math.max(session.peakW, watts);

    if (lastSample) {
      var pieces = math.splitLinearInterval(lastSample, { t: timestamp, w: watts }, midnightBoundaries(lastSample.t, timestamp), MAX_INTEGRATION_GAP_MS);
      if (pieces.length) {
        pieces.forEach(function (piece) {
          session.energyWh += piece.wh;
          session.measuredMs += piece.ms;
          addDailyPiece(piece);
        });
      }
    }
    lastSample = { t: timestamp, w: watts };
    persistSession();
  }

  function consumeReading(sensorId, rawValue, timestamp) {
    var sensor = catalogue[sensorId];
    if (!sensor || sensor.type !== "power") return false;
    var watts = math.parseWatts(rawValue, sensor.units);
    if (watts === null) {
      if (primary && sensorId === primary.id) breakContinuity();
      return false;
    }
    pushGraphSample(sensorId, watts, timestamp);
    tracked[sensorId].watts = watts;
    tracked[sensorId].lastSeenAt = timestamp;
    if (primary && sensorId === primary.id) consumePrimary(watts, timestamp);
    document.body.setAttribute("data-live", "live");
    renderAll();
    return true;
  }

  async function pollOnce() {
    var ids = Object.keys(tracked);
    if (!ids.length) return;
    var timestamp = Date.now();
    var values = await Promise.all(ids.map(function (id) { return ask("getSensorValue", [id]); }));
    ids.forEach(function (id, index) {
      if (values[index] === null || values[index] === undefined) {
        if (primary && id === primary.id) breakContinuity();
        return;
      }
      consumeReading(id, values[index], timestamp);
    });
  }

  function startPolling() {
    clearInterval(pollTimer);
    pollOnce();
    pollTimer = setInterval(pollOnce, POLL_MS);
  }

  function enterState(name, title, body) {
    document.body.setAttribute("data-panel-state", name);
    setText("stateTitle", title);
    setText("stateBody", body);
    renderAll();
  }

  function setTrackedSensors(primarySensor) {
    tracked = {};
    primary = primarySensor;
    if (primarySensor) tracked[primarySensor.id] = { sensor: primarySensor, color: getIcueProperty("accentColor", "#2BE86A"), watts: null };
    if (config.edition === "pro") {
      comparisonSettings().forEach(function (setting) {
        var sensor = catalogue[setting.sensorId];
        if (!sensor || sensor.type !== "power" || sensor.id === primarySensor.id) return;
        tracked[sensor.id] = { sensor: sensor, color: setting.color || "#78A9FF", watts: null };
      });
    }
  }

  async function choosePrimarySensor() {
    var requested = selectedPrimaryId();
    if (requested && catalogue[requested]) return catalogue[requested];
    var defaultId = await ask("getDefaultSensorId", ["power", "total-power-draw"]);
    if (defaultId && catalogue[String(defaultId)]) return catalogue[String(defaultId)];
    var ids = Object.keys(catalogue);
    return ids.length ? catalogue[ids[0]] : null;
  }

  async function scanSensors() {
    if (scanning) return;
    scanning = true;
    try {
      var plugin = sensorPlugin();
      if (!plugin) {
        if (isPreview()) {
          activatePreviewDemo();
        } else {
          breakContinuity();
          enterState("unavailable", "iCUE sensor service unavailable", "The meter will reconnect automatically. No missing interval is estimated.");
        }
        return;
      }
      connectAsync(plugin);
      connectSensorEvents(plugin);
      var found = await discoverCatalogue();
      if (!found) {
        breakContinuity();
        enterState("unavailable", "iCUE sensor service unavailable", "The meter will reconnect automatically. No missing interval is estimated.");
        return;
      }
      if (!Object.keys(found).length) {
        primary = null;
        tracked = {};
        breakContinuity();
        enterState("empty", "No power sensors found", "PC Power Meter can only measure power sensors that iCUE exposes on this hardware.");
        return;
      }
      var chosen = await choosePrimarySensor();
      if (!chosen) {
        enterState("empty", "Choose a power sensor", "Select an iCUE power sensor in widget settings.");
        return;
      }
      var previousId = primary ? primary.id : "";
      setTrackedSensors(chosen);
      if (!session || session.sensorId !== chosen.id || previousId !== chosen.id) loadSession(chosen.id);
      document.body.setAttribute("data-panel-state", "ready");
      renderSensorIdentity();
      startPolling();
    } finally {
      scanning = false;
    }
  }

  function activatePreviewDemo() {
    var demo = {
      id: "preview-power",
      connected: true,
      type: "power",
      kind: "total-power-draw",
      deviceName: "Preview PC",
      sensorName: "Total Power Draw",
      displayName: "Preview PC • Total Power Draw",
      units: "W"
    };
    catalogue = { "preview-power": demo };
    setTrackedSensors(demo);
    if (!session || session.sensorId !== demo.id) session = newSession(demo.id, Date.now() - 7000);
    document.body.setAttribute("data-panel-state", "ready");
    renderSensorIdentity();
    clearInterval(pollTimer);
    pollTimer = setInterval(function () {
      demoPhase += 1;
      var watts = 412 + Math.sin(demoPhase / 3) * 38 + Math.sin(demoPhase / 7) * 15;
      consumeReading(demo.id, watts.toFixed(2), Date.now());
    }, 800);
  }

  function applySettings() {
    document.documentElement.style.setProperty("--text", String(getIcueProperty("textColor", "#F4F6F8") || "#F4F6F8"));
    document.documentElement.style.setProperty("--accent", String(getIcueProperty("accentColor", "#2BE86A") || "#2BE86A"));
    document.documentElement.style.setProperty("--background", String(getIcueProperty("backgroundColor", "#070A0D") || "#070A0D"));
    document.documentElement.style.setProperty("--graph", String(getIcueProperty("graphColor", "#2BE86A") || "#2BE86A"));
    renderAll();
  }

  function renderSensorIdentity() {
    setText("sensorName", primary ? (primary.displayName || sensorDisplayName(primary)) : "Power sensor");
    setText("scopeLabel", scopeLabel(primary));
    setText("infoScope", scopeExplanation(primary));
  }

  function todayEnergyWh() {
    var daily = storeRead("daily", {});
    var item = daily && daily[dayKey(Date.now())];
    return item ? Math.max(0, Number(item.wh) || 0) : 0;
  }

  function renderMetrics() {
    var current = currentW;
    var average = session ? math.averageWatts(session.energyWh, session.measuredMs) : null;
    var energy = math.formatEnergy(session ? session.energyWh : 0);
    var peak = session ? session.peakW : null;
    setText("nowValue", math.formatWatts(current));
    setText("nowUnit", current === null ? "" : "W");
    setText("averageValue", math.formatWatts(average));
    setText("averageUnit", average === null ? "" : "W");
    setText("energyValue", energy.value);
    setText("energyUnit", energy.unit);
    setText("peakValue", math.formatWatts(peak));
    setText("peakUnit", peak === null ? "" : "W");

    if (config.edition === "pro") {
      var rate = Math.max(0, Number(getIcueProperty("electricityRate", 0.15)) || 0);
      var cost = math.costForEnergy(session ? session.energyWh : 0, rate);
      var symbol = String(getIcueProperty("currencySymbol", "$"));
      setText("costValue", cost === null ? "—" : symbol + cost.toFixed(cost < 10 ? 3 : 2));
      var today = math.formatEnergy(todayEnergyWh());
      setText("todayValue", today.value);
      setText("todayUnit", today.unit);
      var threshold = Math.max(0, Number(getIcueProperty("highPowerThreshold", 0)) || 0);
      document.body.setAttribute("data-threshold", threshold > 0 && current !== null && current >= threshold ? "high" : "normal");
    }
  }

  function pathForSamples(samples, minT, maxT, maxW) {
    if (!samples || !samples.length || !(maxT > minT) || !(maxW > 0)) return "";
    return samples.map(function (sample, index) {
      var x = ((sample.t - minT) / (maxT - minT)) * 1000;
      var y = 280 - (sample.w / maxW) * 248;
      return (index ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(1);
    }).join(" ");
  }

  function renderGraph() {
    var svg = byId("powerGraph");
    if (!svg) return;
    var now = Date.now();
    var windowMs = graphWindowMs();
    var minT = now - windowMs;
    var ids = Object.keys(tracked);
    var all = [];
    ids.forEach(function (id) {
      (graphSeries[id] || []).forEach(function (sample) { if (sample.t >= minT) all.push(sample); });
    });
    var maxW = Math.max(100, all.reduce(function (max, sample) { return Math.max(max, sample.w); }, 0) * 1.12);
    var markup = '<line class="gridline" x1="0" y1="94" x2="1000" y2="94"></line><line class="gridline" x1="0" y1="187" x2="1000" y2="187"></line>';
    ids.forEach(function (id, index) {
      var samples = (graphSeries[id] || []).filter(function (sample) { return sample.t >= minT; });
      if (!samples.length) return;
      var item = tracked[id];
      var color = item && item.color ? item.color : (index === 0 ? String(getIcueProperty("graphColor", "#2BE86A")) : "#78A9FF");
      var d = pathForSamples(samples, minT, now, maxW);
      markup += '<path class="series ' + (id === (primary && primary.id) ? "is-primary" : "") + '" data-sensor="' + id.replace(/"/g, "") + '" d="' + d + '" style="stroke:' + color.replace(/"/g, "") + '"></path>';
    });
    svg.innerHTML = markup;
    setText("graphScale", "0 – " + math.formatWatts(maxW) + " W");
  }

  function renderComparisons() {
    var board = byId("comparisonBoard");
    if (!board || config.edition !== "pro") return;
    var ids = Object.keys(tracked).filter(function (id) { return !primary || id !== primary.id; });
    if (!ids.length) {
      board.innerHTML = '<div class="comparison-empty">Add comparison power sensors in iCUE settings.</div>';
      return;
    }
    board.innerHTML = ids.map(function (id) {
      var item = tracked[id];
      var sensor = item.sensor;
      return '<article class="comparison-card"><span class="compare-dot" style="background:' + String(item.color || "#78A9FF") + '"></span><div class="compare-copy"><b>' + escapeHtml(sensor.displayName || sensorDisplayName(sensor)) + '</b><span>' + escapeHtml(scopeLabel(sensor).replace(" • MEASURED", "")) + '</span></div><strong>' + math.formatWatts(item.watts) + '<small>' + (item.watts === null ? "" : " W") + '</small></strong></article>';
    }).join("");
  }

  function renderHistory() {
    if (config.edition !== "pro") return;
    var el = byId("historySummary");
    if (!el) return;
    var history = storeRead("history", []);
    if (!Array.isArray(history) || !history.length) {
      el.textContent = "No previous sessions yet";
      return;
    }
    var last = history[0];
    var e = math.formatEnergy(last.energyWh);
    var avg = math.averageWatts(last.energyWh, last.measuredMs);
    el.textContent = "LAST SESSION  " + e.value + " " + e.unit + "  •  AVG " + math.formatWatts(avg) + " W";
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
    });
  }

  function renderAll() {
    renderMetrics();
    renderGraph();
    renderComparisons();
    renderHistory();
    setHidden("dashboard", document.body.getAttribute("data-panel-state") !== "ready");
    setHidden("statePanel", document.body.getAttribute("data-panel-state") === "ready");
    setHidden("infoOverlay", !infoOpen);
  }

  function bindUi() {
    var info = byId("infoButton");
    var close = byId("closeInfo");
    var reset = byId("resetSession");
    var pro = byId("proLink");
    if (info) info.addEventListener("click", function () { infoOpen = true; renderAll(); });
    if (close) close.addEventListener("click", function () { infoOpen = false; renderAll(); });
    if (reset) reset.addEventListener("click", function () { resetSession(); infoOpen = false; });
    if (pro) pro.addEventListener("click", function () {
      var url = String(config.proUrl || "");
      if (!url) return;
      try {
        if (window.plugins && window.plugins.Linkprovider && globalThis.pluginLinkprovider_initialized) window.plugins.Linkprovider.open(url);
        else window.open(url, "_blank");
      } catch (e) { }
    });
  }

  function boot() {
    applySlot();
    document.body.setAttribute("data-edition", config.edition || "lite");
    applySettings();
    bindUi();
    scanSensors();
    clearInterval(reconcileTimer);
    reconcileTimer = setInterval(function () { scheduleScan(0); }, 15000);
    window.addEventListener("resize", function () { applySlot(); renderAll(); });
    window.addEventListener("beforeunload", persistSession);
  }

  globalThis.PackRatPowerMeterTest = {
    getSession: function () { return session ? JSON.parse(JSON.stringify(session)) : null; },
    getPrimary: function () { return primary ? JSON.parse(JSON.stringify(primary)) : null; },
    getCatalogue: function () { return JSON.parse(JSON.stringify(catalogue)); },
    getTracked: function () { return JSON.parse(JSON.stringify(tracked)); },
    forceScan: scanSensors,
    resetSession: resetSession,
    breakContinuity: breakContinuity
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
