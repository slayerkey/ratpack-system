function convertTemp(c) {
  if (c === null) return null;
  return settings().tempUnit === "f" ? (c * 9 / 5 + 32) : c;
}

function consumeMetric(role, value) {
  if (!Number.isFinite(value)) return;
  state.metrics[role] = value;
  pushHistory(role, value);
  renderHealth();
  drawPerformanceGraph();
}

function historyLimit() { return 930; }
function pushHistory(key, value) {
  var arr = state.history[key] || (state.history[key] = []);
  arr.push({ at: Date.now(), value: value });
  if (arr.length > historyLimit()) arr.splice(0, arr.length - historyLimit());
}

function tempText(c, decimals) {
  if (!Number.isFinite(c)) return "—";
  return String(Math.round(convertTemp(c) * (decimals ? 10 : 1)) / (decimals ? 10 : 1));
}

function deltaText(key, current) {
  var arr = state.history[key] || [];
  if (arr.length < 8 || !Number.isFinite(current)) return "LIVE";
  var target = Date.now() - 4 * 60 * 1000;
  var base = arr[0].value;
  for (var i = 0; i < arr.length; i++) {
    if (arr[i].at >= target) { base = arr[i].value; break; }
  }
  var delta = current - base;
  var isTemp = key.toLowerCase().indexOf("temp") >= 0;
  if (isTemp) delta = settings().tempUnit === "f" ? delta * 9 / 5 : delta;
  if (Math.abs(delta) < 0.8) return "STEADY";
  return (delta > 0 ? "+" : "") + Math.round(delta) + (isTemp ? "°" : "%") + " / 4M";
}

function healthAlert(celsius) {
  if (!Number.isFinite(celsius)) return "";
  if (celsius >= 90) return "danger";
  if (celsius >= 82) return "warn";
  return "";
}

function renderHealth() {
  var m = state.metrics;
  setText("gpuTemp", tempText(m.gpuTemp));
  setText("cpuTemp", tempText(m.cpuTemp));
  setText("gpuLoad", Number.isFinite(m.gpuLoad) ? String(Math.round(m.gpuLoad)) : "—");
  setText("cpuLoad", Number.isFinite(m.cpuLoad) ? String(Math.round(m.cpuLoad)) : "—");
  setText("gpuTempTrend", deltaText("gpuTemp", m.gpuTemp));
  setText("cpuTempTrend", deltaText("cpuTemp", m.cpuTemp));
  setText("gpuLoadTrend", deltaText("gpuLoad", m.gpuLoad));
  setText("cpuLoadTrend", deltaText("cpuLoad", m.cpuLoad));
  setText("perfGpuTemp", tempText(m.gpuTemp) + "°");
  setText("perfCpuTemp", tempText(m.cpuTemp) + "°");
  setText("perfGpuLoad", Number.isFinite(m.gpuLoad) ? Math.round(m.gpuLoad) + "%" : "—%");
  setText("perfCpuLoad", Number.isFinite(m.cpuLoad) ? Math.round(m.cpuLoad) + "%" : "—%");
  byId("gpuBar").style.width = Number.isFinite(m.gpuLoad) ? clamp(m.gpuLoad,0,100) + "%" : "0%";
  byId("cpuBar").style.width = Number.isFinite(m.cpuLoad) ? clamp(m.cpuLoad,0,100) + "%" : "0%";

  var gpuTile = document.querySelector('[data-metric-detail="gpuTemp"]');
  var cpuTile = document.querySelector('[data-metric-detail="cpuTemp"]');
  if (gpuTile) gpuTile.setAttribute("data-alert", healthAlert(m.gpuTemp));
  if (cpuTile) cpuTile.setAttribute("data-alert", healthAlert(m.cpuTemp));

  var worst = Math.max(Number(m.gpuTemp) || 0, Number(m.cpuTemp) || 0);
  setText("healthState", worst >= 90 ? "HOT" : worst >= 82 ? "WARM" : (Number.isFinite(m.gpuTemp) || Number.isFinite(m.cpuTemp) ? "GOOD" : "READY"));
  renderAmbientHealth();
}

async function pollFps() {
  if (state.preview) {
    var phase = Date.now() / 1000;
    state.fps.available = true;
    state.fps.value = Math.round(226 + Math.sin(phase / 5.1) * 17 + Math.sin(phase * 1.7) * 4);
    state.fps.process = "VALORANT-Win64-Shipping.exe";
    consumeFps();
    return;
  }
  var result = await Promise.all([
    ask("Fpsdataprovider", "fps", "getFpsAvailable", []),
    ask("Fpsdataprovider", "fps", "getCurrentFps", []),
    ask("Fpsdataprovider", "fps", "getCurrentProcess", [])
  ]);
  state.fps.available = result[0] === true;
  state.fps.value = finite(result[1]);
  state.fps.process = String(result[2] || "");
  consumeFps();
}

function consumeFps() {
  if (state.fps.available && Number.isFinite(state.fps.value)) pushHistory("fps", state.fps.value);
  setText("fpsValue", state.fps.available && Number.isFinite(state.fps.value) ? String(Math.round(state.fps.value)) : "—");
  var process = state.fps.process ? state.fps.process.replace(/\.exe$/i, "") : "";
  setText("gameLabel", process ? process.toUpperCase() : "PERFORMANCE");
  setText("fpsSub", state.fps.available ? (process || "FPS session active") : "Waiting for iCUE FPS");
  setText("sampleCount", (state.history.fps.length || 0) + " SAMPLES");
  maybeSmartMode();
  drawPerformanceGraph();
  renderContext();
}

async function pollMedia() {
  if (state.preview) {
    state.media.available = true;
    state.media.title = "Midnight City";
    state.media.artist = "M83";
    renderContext();
    return;
  }
  var values = await Promise.all([
    ask("Mediadataprovider", "media", "getSongName", []),
    ask("Mediadataprovider", "media", "getArtist", [])
  ]);
  if (values[0] === null && values[1] === null) {
    state.media.available = false;
    return;
  }
  state.media.available = true;
  state.media.title = String(values[0] || "").trim();
  state.media.artist = String(values[1] || "").trim();
  renderContext();
}

function mediaAction(method, button) {
  var p = plugin("Mediadataprovider");
  if (!p || typeof p[method] !== "function") {
    if (button) {
      button.setAttribute("data-fired", "unavailable");
      setTimeout(function(){ button.removeAttribute("data-fired"); }, 450);
    }
    pollMedia();
    return false;
  }
  try {
    p[method].call(p);
    state.media.lastAction = method;
    state.media.lastActionAt = Date.now();
    if (button) {
      button.setAttribute("data-fired", "true");
      setTimeout(function(){ button.removeAttribute("data-fired"); }, 220);
    }
    setTimeout(pollMedia, 120);
    setTimeout(pollMedia, 650);
    return true;
  } catch (e) {
    if (button) {
      button.setAttribute("data-fired", "error");
      setTimeout(function(){ button.removeAttribute("data-fired"); }, 450);
    }
    return false;
  }
}

function weatherCode(code) {
  var c = Number(code);
  if (c === 0) return { label: "Clear", icon: "☀" };
  if (c <= 3) return { label: "Partly cloudy", icon: "◐" };
  if (c === 45 || c === 48) return { label: "Fog", icon: "≋" };
  if (c >= 51 && c <= 67) return { label: "Rain", icon: "☂" };
  if (c >= 71 && c <= 77) return { label: "Snow", icon: "✦" };
  if (c >= 80 && c <= 82) return { label: "Showers", icon: "☂" };
  if (c >= 95) return { label: "Storm", icon: "ϟ" };
  return { label: "Weather", icon: "○" };
}
