function renderContext() {
  var card = byId("contextCard"); if (!card) return;
  var alert = "";
  var next = nextEvent();
  var minutesToEvent = next ? (next.start.getTime() - Date.now()) / 60000 : Infinity;
  var worstTemp = Math.max(Number(state.metrics.gpuTemp) || 0, Number(state.metrics.cpuTemp) || 0);

  var context = null;
  if (worstTemp >= 90) {
    context = { kind:"THERMAL", title:"Your PC is running hot.", body:"Open Performance to see whether the spike is sustained.", left:"PC HEALTH", right:"VIEW HISTORY", alert:"danger", drawer:"performance" };
  } else if (state.network.state === "degraded") {
    context = { kind:"CONNECTION", title:"Connection quality degraded.", body:"Response timing or verified probes have worsened. Open the network detail before blaming the game.", left:"NETWORK", right:"VIEW DETAILS", alert:"warn", drawer:"network" };
  } else if (next && minutesToEvent >= -5 && minutesToEvent <= 45) {
    context = { kind:"NEXT", title:next.summary || "Upcoming event", body:(next.allDay ? "All day" : relativeEvent(next) + " • " + formatTime(next.start, false)) + (next.location ? " • " + next.location : ""), left:"CALENDAR", right:"VIEW EVENT", drawer:"event" };
  } else if (state.media.title) {
    context = { kind:"NOW PLAYING", title:state.media.title, body:(state.media.artist || "Windows system media") + " • tap for controls", left:"MEDIA", right:"PLAYBACK", drawer:"media" };
  } else if (state.fps.available && state.fps.value > 0 && state.fps.process) {
    context = { kind:"GAME", title:Math.round(state.fps.value) + " FPS", body:state.fps.process.replace(/\.exe$/i,"") + " • performance history is recording", left:"PERFORMANCE", right:"OPEN", drawer:"performance" };
  } else if (state.weather.ready && state.weather.current) {
    var maxRain = 0;
    state.weather.hourly.slice(0,8).forEach(function(h){ maxRain = Math.max(maxRain, h.rain || 0); });
    var wc = weatherCode(state.weather.current.code);
    context = { kind:"TODAY", title:wc.label + " • " + displayTemperature(state.weather.current.temp) + "°", body:maxRain >= 40 ? "Rain risk reaches " + Math.round(maxRain) + "% in the next 8 hours." : "Nothing urgent in the next few hours.", left:"WEATHER", right:"VIEW TIMELINE", drawer:"weather" };
  } else {
    context = { kind:"READY", title:"Your XENEON, all in one.", body:"Smart Mode will surface media, meetings, games and connection problems here.", left:"PACKRAT", right:"TAP FOR DETAILS", drawer:"about" };
  }
  setText("contextKicker", context.kind);
  setText("contextReason", context.kind);
  setText("contextTitle", context.title);
  setText("contextBody", context.body);
  setText("contextFootLeft", context.left);
  setText("contextFootRight", context.right);
  card.setAttribute("data-drawer", context.drawer);
  document.body.setAttribute("data-context-alert", context.alert || "");
  renderAmbientHealth();
}

function renderAmbientHealth() {
  var worst = Math.max(Number(state.metrics.gpuTemp) || 0, Number(state.metrics.cpuTemp) || 0);
  var words = [];
  if (worst >= 90) words.push("THERMAL ALERT");
  else if (worst >= 82) words.push("SYSTEM WARM");
  else words.push("SYSTEM GOOD");
  if (state.network.state === "degraded") words.push("NETWORK DEGRADED");
  else if (state.network.current !== null) words.push("NETWORK STABLE");
  setText("ambientHealth", words.join(" • "));
  if (state.media.title) setText("ambientContext", state.media.title.toUpperCase() + (state.media.artist ? " • " + state.media.artist.toUpperCase() : ""));
  else if (nextEvent()) setText("ambientContext", "NEXT • " + (nextEvent().summary || "EVENT").toUpperCase());
  else setText("ambientContext", "PACKRAT");
}

function graphWindowMs() {
  var g = settings().graphWindow;
  return g === "60s" ? 60000 : g === "15m" ? 900000 : 300000;
}

function windowSeries(key) {
  var cutoff = Date.now() - graphWindowMs();
  return (state.history[key] || []).filter(function (p) { return p.at >= cutoff; });
}

function fitCanvas(canvas) {
  if (!canvas) return null;
  var rect = canvas.getBoundingClientRect();
  var dpr = Math.min(2, window.devicePixelRatio || 1);
  var w = Math.max(1, Math.round(rect.width * dpr)), h = Math.max(1, Math.round(rect.height * dpr));
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  return { w:w, h:h, dpr:dpr };
}

function cssColor(name, fallback) {
  try { return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback; } catch (e) { return fallback; }
}
