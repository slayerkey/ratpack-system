function plugin(name) {
  try { return window.plugins && window.plugins[name]; } catch (e) { return null; }
}

function connectAsync(pluginName, bucket) {
  var p = plugin(pluginName);
  if (!p || !p.asyncResponse || typeof p.asyncResponse.connect !== "function") return false;
  if (state.connectedPlugins[pluginName]) return true;
  try {
    p.asyncResponse.connect(function (requestId, value) {
      var pending = state.pending[bucket][requestId];
      if (!pending) return;
      clearTimeout(pending.timer);
      delete state.pending[bucket][requestId];
      pending.resolve(value);
    });
    state.connectedPlugins[pluginName] = true;
    return true;
  } catch (e) { return false; }
}

function ask(pluginName, bucket, method, args) {
  var p = plugin(pluginName);
  if (!p || typeof p[method] !== "function" || !connectAsync(pluginName, bucket)) return Promise.resolve(null);
  var id = ++state.requestId;
  return new Promise(function (resolve) {
    var timer = setTimeout(function () {
      delete state.pending[bucket][id];
      resolve(null);
    }, 3500);
    state.pending[bucket][id] = { resolve: resolve, timer: timer };
    try { p[method].apply(p, [id].concat(args || [])); }
    catch (e) {
      clearTimeout(timer);
      delete state.pending[bucket][id];
      resolve(null);
    }
  });
}

async function discoverSensors() {
  var ids = await ask("Sensorsdataprovider", "sensors", "getAllSensorIds", []);
  if (!Array.isArray(ids)) {
    if (state.preview) installPreviewSensors();
    return;
  }
  var inspected = await Promise.all(ids.map(async function (id) {
    var sid = String(id);
    var values = await Promise.all([
      ask("Sensorsdataprovider", "sensors", "getSensorDeviceName", [sid]),
      ask("Sensorsdataprovider", "sensors", "getSensorName", [sid]),
      ask("Sensorsdataprovider", "sensors", "getSensorUnits", [sid]),
      ask("Sensorsdataprovider", "sensors", "getSensorType", [sid]),
      ask("Sensorsdataprovider", "sensors", "getSensorKind", [sid])
    ]);
    return {
      id: sid,
      device: String(values[0] || ""),
      name: String(values[1] || ""),
      units: String(values[2] || ""),
      type: String(values[3] || ""),
      kind: String(values[4] || "")
    };
  }));
  state.sensorCatalog = {};
  inspected.forEach(function (s) { state.sensorCatalog[s.id] = s; });
  state.sensorRoles.cpuTemp = bestSensor(inspected, "cpu", "temp");
  state.sensorRoles.gpuTemp = bestSensor(inspected, "gpu", "temp");
  state.sensorRoles.cpuLoad = bestSensor(inspected, "cpu", "load");
  state.sensorRoles.gpuLoad = bestSensor(inspected, "gpu", "load");
  renderHealth();
}

function roleScore(sensor, target, kind) {
  var text = (sensor.device + " " + sensor.name + " " + sensor.kind + " " + sensor.type).toLowerCase();
  var units = sensor.units.toLowerCase();
  var score = 0;
  if (target === "cpu") {
    if (/\bcpu\b|processor|package/.test(text)) score += 10;
    if (/gpu|graphics|geforce|radeon/.test(text)) score -= 12;
  } else {
    if (/gpu|graphics|geforce|radeon/.test(text)) score += 12;
    if (/\bcpu\b|processor/.test(text)) score -= 10;
  }
  if (kind === "temp") {
    if (/temp|temperature|hotspot|junction/.test(text)) score += 7;
    if (/°c|celsius/.test(units) || sensor.type.toLowerCase() === "temperature") score += 8;
    if (/load|util|usage/.test(text)) score -= 8;
  } else {
    if (/load|util|usage|activity/.test(text)) score += 8;
    if (units === "%" || units.indexOf("%") >= 0) score += 6;
    if (/temp|temperature/.test(text)) score -= 8;
  }
  if (/average|avg/.test(text)) score += 1;
  return score;
}

function bestSensor(list, target, kind) {
  var best = null, score = 1;
  list.forEach(function (sensor) {
    var next = roleScore(sensor, target, kind);
    if (next > score) { score = next; best = sensor.id; }
  });
  return best;
}

function installPreviewSensors() {
  state.sensorRoles = { cpuTemp: "preview-cpu-temp", gpuTemp: "preview-gpu-temp", cpuLoad: "preview-cpu-load", gpuLoad: "preview-gpu-load" };
}

async function pollSensors() {
  if (state.preview) {
    var t = Date.now() / 1000;
    consumeMetric("gpuTemp", 63 + Math.sin(t / 9) * 4 + Math.sin(t / 2.6) * 1.1);
    consumeMetric("cpuTemp", 57 + Math.sin(t / 7) * 5 + Math.sin(t / 3.1) * 1.5);
    consumeMetric("gpuLoad", 72 + Math.sin(t / 5) * 22);
    consumeMetric("cpuLoad", 41 + Math.sin(t / 6.3) * 18);
    return;
  }
  var roles = Object.keys(state.sensorRoles);
  await Promise.all(roles.map(async function (role) {
    var id = state.sensorRoles[role];
    if (!id) return;
    var value = await ask("Sensorsdataprovider", "sensors", "getSensorValue", [String(id)]);
    var n = finite(value);
    if (n !== null) consumeMetric(role, n);
  }));
}
