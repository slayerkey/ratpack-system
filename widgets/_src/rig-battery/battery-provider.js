function normalizeName(value, fallback) {
  var name = String(value == null ? "" : value).trim();
  return name || String(fallback || "").trim() || wirelessDeviceLabel;
}

async function inspectSensor(sensorId, type) {
  var result = await Promise.all([
    ask("sensorIsConnected", [sensorId]),
    ask("getSensorDeviceName", [sensorId]),
    ask("getSensorName", [sensorId]),
    ask("getSensorUnits", [sensorId]),
    ask("getSensorValue", [sensorId])
  ]);
  if (result[0] === false) return null;
  return {
    id: String(sensorId),
    type: type,
    connected: result[0] !== false,
    deviceName: String(result[1] || "").trim(),
    sensorName: String(result[2] || "").trim(),
    units: String(result[3] || "").trim(),
    value: result[4]
  };
}

function pairDevices(sensors) {
  var groups = {};
  sensors.forEach(function (sensor, index) {
    if (!sensor) return;
    var base = normalizeName(sensor.deviceName, sensor.sensorName);
    if (!groups[base]) groups[base] = { charges: [], statuses: [] };
    sensor.order = index;
    if (sensor.type === "battery-charge") groups[base].charges.push(sensor);
    else if (sensor.type === "battery-status") groups[base].statuses.push(sensor);
  });

  var out = [];
  Object.keys(groups).forEach(function (baseName) {
    var group = groups[baseName];
    group.charges.sort(function (a, b) { return a.order - b.order; });
    group.statuses.sort(function (a, b) { return a.order - b.order; });
    group.charges.forEach(function (chargeSensor, index) {
      var statusSensor = group.statuses[index] || null;
      var pct = parsePercent(chargeSensor.value);
      var status = statusSensor ? statusInfo(statusSensor.value, statusSensor.units) : { raw: "", state: "unknown", etaMinutes: null };
      var suffix = group.charges.length > 1 ? " " + (index + 1) : "";
      out.push({
        key: baseName + "\u0000" + index,
        name: baseName + suffix,
        baseName: baseName,
        percentage: pct,
        chargeSensorId: chargeSensor.id,
        statusSensorId: statusSensor ? statusSensor.id : "",
        statusRaw: status.raw,
        statusState: status.state,
        etaMinutes: status.etaMinutes,
        live: true
      });
    });
  });

  out.sort(function (a, b) {
    var ap = a.percentage == null ? 101 : a.percentage;
    var bp = b.percentage == null ? 101 : b.percentage;
    if (ap !== bp) return ap - bp;
    return a.name.localeCompare(b.name);
  });
  return out;
}

function rebuildSensorMap() {
  sensorToCard = {};
  cards.forEach(function (card) {
    if (card.chargeSensorId) sensorToCard[card.chargeSensorId] = card.key;
    if (card.statusSensorId) sensorToCard[card.statusSensorId] = card.key;
  });
}

async function updateOneSensor(sensorId, value) {
  var key = sensorToCard[sensorId];
  if (!key) return;
  var card = cards.find(function (item) { return item.key === key; });
  if (!card) return;
  if (card.chargeSensorId === sensorId) {
    card.percentage = parsePercent(value);
  } else if (card.statusSensorId === sensorId) {
    var units = await ask("getSensorUnits", [sensorId]);
    var info = statusInfo(value, units);
    card.statusRaw = info.raw;
    card.statusState = info.state;
    card.etaMinutes = info.etaMinutes;
  }
  cards.sort(function (a, b) {
    var ap = a.percentage == null ? 101 : a.percentage;
    var bp = b.percentage == null ? 101 : b.percentage;
    if (ap !== bp) return ap - bp;
    return a.name.localeCompare(b.name);
  });
  storeLiveCards();
  renderCards();
}

function storeLiveCards() {
  var payload = cards.filter(function (card) { return card.live; }).map(function (card) {
    return {
      key: card.key,
      name: card.name,
      baseName: card.baseName,
      percentage: card.percentage,
      chargeSensorId: card.chargeSensorId,
      statusSensorId: card.statusSensorId,
      statusRaw: card.statusRaw,
      statusState: card.statusState,
      etaMinutes: card.etaMinutes,
      live: false
    };
  });
  if (payload.length) storeWrite("last-good", { at: Date.now(), cards: payload });
}

function restoreCache() {
  var cached = storeRead("last-good", null);
  if (!cached || !Array.isArray(cached.cards) || !cached.cards.length) return false;
  cards = cached.cards.map(function (card) {
    card.live = false;
    return card;
  });
  rebuildSensorMap();
  document.body.setAttribute("data-panel-state", "ready");
  setFreshness(true);
  renderCards();
  return true;
}

async function scanSensors() {
  if (scanRunning) return;
  scanRunning = true;
  try {
    var plugin = sensorPlugin();
    if (!plugin) {
      if (!cards.length && !restoreCache()) await showState("unavailable");
      else setFreshness(true);
      return;
    }
    connectAsync(plugin);
    connectSensorEvents(plugin);

    var ids = await ask("getAllSensorIds", []);
    if (!Array.isArray(ids)) {
      if (!cards.length && !restoreCache()) await showState("unavailable");
      else setFreshness(true);
      return;
    }

    var types = await Promise.all(ids.map(function (sensorId) { return ask("getSensorType", [sensorId]); }));
    var candidates = [];
    ids.forEach(function (sensorId, index) {
      var type = String(types[index] || "").trim().toLowerCase();
      if (type === "battery-charge" || type === "battery-status") candidates.push({ id: String(sensorId), type: type });
    });

    if (!candidates.length) {
      cards = [];
      sensorToCard = {};
      storeWrite("last-good", null);
      lastLiveScan = Date.now();
      await showState("empty");
      return;
    }

    var inspected = await Promise.all(candidates.map(function (item) { return inspectSensor(item.id, item.type); }));
    cards = pairDevices(inspected.filter(Boolean));
    rebuildSensorMap();
    lastLiveScan = Date.now();

    if (!cards.length) {
      storeWrite("last-good", null);
      await showState("empty");
      return;
    }

    document.body.setAttribute("data-panel-state", "ready");
    setFreshness(false);
    storeLiveCards();
    renderCards();
  } finally {
    scanRunning = false;
  }
}
