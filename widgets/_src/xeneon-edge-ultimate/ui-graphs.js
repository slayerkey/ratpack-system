function drawPerformanceGraph() {
  var canvas = byId("performanceGraph"), size = fitCanvas(canvas);
  if (!canvas || !size || state.mode !== "performance") return;
  var ctx = canvas.getContext("2d"), w = size.w, h = size.h;
  ctx.clearRect(0,0,w,h);
  var accent = cssColor("--accent","#2BE86A"), text = cssColor("--text","#F5F7FA");
  ctx.lineWidth = Math.max(1, 1 * size.dpr);
  ctx.strokeStyle = "rgba(255,255,255,.07)";
  for (var g=1;g<4;g++) { ctx.beginPath(); ctx.moveTo(0,h*g/4); ctx.lineTo(w,h*g/4); ctx.stroke(); }

  var now = Date.now(), win = graphWindowMs();
  function plot(key, min, max, color, width) {
    var arr = windowSeries(key); if (arr.length < 2) return;
    ctx.strokeStyle = color; ctx.lineWidth = width * size.dpr; ctx.lineJoin = "round"; ctx.lineCap = "round";
    ctx.beginPath();
    arr.forEach(function(p,i) {
      var x = clamp((p.at - (now-win))/win,0,1) * w;
      var y = h - clamp((p.value-min)/(max-min),0,1) * h;
      if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    });
    ctx.stroke();
  }
  var fps = windowSeries("fps").map(function(p){return p.value;});
  var fpsMax = Math.max(180, Math.ceil((fps.length ? Math.max.apply(null,fps) : 240)/30)*30);
  plot("fps",0,fpsMax,accent,2.4);
  plot("gpuTemp",25,100,"rgba(245,247,250,.58)",1.4);
  plot("cpuTemp",25,100,"rgba(245,247,250,.24)",1.2);
  setText("graphAgo", settings().graphWindow === "60s" ? "60 SEC AGO" : settings().graphWindow === "15m" ? "15 MIN AGO" : "5 MIN AGO");
}

function drawSvgSeries(svg, values, color, min, max) {
  if (!svg) return;
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  if (!values || values.length < 2) return;
  var pts = values.map(function(v,i) {
    var x = (i/(values.length-1))*300;
    var y = 66 - clamp((v-min)/(max-min),0,1)*58;
    return x.toFixed(1)+","+y.toFixed(1);
  }).join(" ");
  var ns = "http://www.w3.org/2000/svg";
  var line = document.createElementNS(ns,"polyline");
  line.setAttribute("points",pts); line.setAttribute("fill","none"); line.setAttribute("stroke",color);
  line.setAttribute("stroke-width","3"); line.setAttribute("stroke-linecap","round"); line.setAttribute("stroke-linejoin","round");
  svg.appendChild(line);
}

function drawNetworkSpark() {
  var values = state.history.network.slice(-32).map(function(p){return p.value;});
  var max = Math.max(180, values.length ? Math.max.apply(null,values)*1.15 : 180);
  drawSvgSeries(byId("networkSpark"), values, cssColor("--accent","#2BE86A"), 0, max);
}

function drawWeatherSpark() {
  var values = state.weather.hourly.slice(0,9).map(function(h){return h.temp;}).filter(Number.isFinite);
  if (!values.length) { drawSvgSeries(byId("weatherSpark"), [], cssColor("--accent","#2BE86A"),0,1); return; }
  var min = Math.min.apply(null,values)-2, max=Math.max.apply(null,values)+2;
  drawSvgSeries(byId("weatherSpark"), values, cssColor("--accent","#2BE86A"), min, max);
}

function renderFocus() {
  var cfg = settings();
  var remaining = state.focus.remainingMs;
  if (state.focus.running) {
    remaining = Math.max(0, state.focus.endsAt - Date.now());
    state.focus.remainingMs = remaining;
    if (remaining <= 0) {
      state.focus.running = false;
      state.focus.endsAt = 0;
      state.focus.remainingMs = cfg.focusMinutes * 60000;
    }
  }
  if (!state.focus.running && !remaining) remaining = cfg.focusMinutes * 60000;
  var totalSeconds = Math.max(0, Math.ceil(remaining / 1000));
  var mins = Math.floor(totalSeconds / 60), secs = totalSeconds % 60;
  setText("focusClock", String(mins).padStart(2,"0") + ":" + String(secs).padStart(2,"0"));
  setText("focusToggle", state.focus.running ? "PAUSE" : "START");
  setText("focusState", state.focus.running ? "FOCUSING" : "READY");
  storeWrite("focus", state.focus);
}

function toggleFocus() {
  var cfg = settings();
  if (state.focus.running) {
    state.focus.remainingMs = Math.max(0, state.focus.endsAt - Date.now());
    state.focus.running = false; state.focus.endsAt = 0;
  } else {
    if (!state.focus.remainingMs || state.focus.remainingMs <= 0) state.focus.remainingMs = cfg.focusMinutes * 60000;
    state.focus.running = true;
    state.focus.endsAt = Date.now() + state.focus.remainingMs;
  }
  renderFocus();
}

function resetFocus() {
  state.focus.running = false; state.focus.endsAt = 0; state.focus.remainingMs = settings().focusMinutes * 60000;
  renderFocus();
}
