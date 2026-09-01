function renderAll() {
  var cfg = settings();
  renderHealth(); renderWeather(); renderAgenda(); renderNetwork(); renderFocus(); renderContext();
  setText("smartPerfState", cfg.smartMode && cfg.startMode === "auto" ? (Date.now()<state.manualHoldUntil?"HOLD":"AUTO") : "MANUAL");
  drawPerformanceGraph(); drawNetworkSpark(); drawWeatherSpark();
}

function bindUi() {
  if (state.uiBound) return;
  document.querySelectorAll(".navButton[data-mode-target]").forEach(function(button){
    button.addEventListener("click",function(){ setMode(button.getAttribute("data-mode-target"), true); });
  });
  byId("autoButton").addEventListener("click", resumeAuto);
  byId("contextCard").addEventListener("click", openContextDrawer);
  byId("weatherSummary").addEventListener("click", openWeatherDrawer);
  byId("networkChip").addEventListener("click", openNetworkDrawer);
  byId("perfNetworkButton").addEventListener("click", openNetworkDrawer);
  byId("eventChip").addEventListener("click", function(){ var e=nextEvent(); if(e)openEventDrawer(e); else setMode("today",true); });
  document.querySelectorAll("[data-metric-detail]").forEach(function(button){
    button.addEventListener("click",function(){openMetricDrawer(button.getAttribute("data-metric-detail"));});
  });
  byId("focusToggle").addEventListener("click", toggleFocus);
  byId("focusReset").addEventListener("click", resetFocus);
  byId("drawerClose").addEventListener("click", closeDrawer);
  byId("drawerBackdrop").addEventListener("click", closeDrawer);
  byId("drawerBody").addEventListener("click", function(event){
    var button = event.target.closest && event.target.closest("[data-media-action]");
    if (!button || !byId("drawerBody").contains(button)) return;
    event.preventDefault();
    mediaAction(button.getAttribute("data-media-action"), button);
  });
  window.addEventListener("resize", applySlot);
  state.uiBound = true;
}

function startTimers() {
  if (state.timersStarted) return;
  state.timersStarted = true;
  state.timers.push(setInterval(syncSettings,250));
  state.timers.push(setInterval(updateClock,1000));
  state.timers.push(setInterval(function(){ optionalRuntime("poll sensors", pollSensors); },1000));
  state.timers.push(setInterval(function(){ optionalRuntime("poll FPS", pollFps); },1000));
  state.timers.push(setInterval(function(){ optionalRuntime("poll media", pollMedia); },1500));
  state.timers.push(setInterval(function(){ optionalRuntime("probe network", probeNetwork); },5000));
  state.timers.push(setInterval(function(){ optionalRuntime("refresh weather", function(){ return refreshWeather(false); }); }, 10*60*1000));
  state.timers.push(setInterval(function(){ optionalRuntime("refresh calendar", function(){ return refreshCalendar(false); }); }, 8*60*1000));
}

function runtimeWarning(label, error) {
  state.runtimeWarnings = state.runtimeWarnings || [];
  state.runtimeWarnings.push({ label: label, message: String(error && error.message ? error.message : error), at: Date.now() });
  if (state.runtimeWarnings.length > 20) state.runtimeWarnings.shift();
  try { console.warn("XENEON EDGE Ultimate " + label + " failed:", error); } catch (e) {}
}

function optionalRuntime(label, fn) {
  try {
    return Promise.resolve(fn()).catch(function(error){ runtimeWarning(label, error); return null; });
  } catch (error) {
    runtimeWarning(label, error);
    return Promise.resolve(null);
  }
}

function scheduleStartRetry() {
  state.startAttempts = Number(state.startAttempts || 0) + 1;
  if (state.startAttempts > 3 || state.startRetryTimer) return;
  state.startRetryTimer = setTimeout(function(){
    state.startRetryTimer = null;
    start();
  }, 500 * state.startAttempts);
}

async function start() {
  if (state.started || state.starting) return;
  state.starting = true;
  try {
    state.preview = isPreview();
    applySlot();
    bindUi();

    try { applySettings(true); }
    catch (settingsError) { runtimeWarning("apply settings", settingsError); }
    updateClock();

    var cacheWeather = storeRead("weather-cache", null);
    if (cacheWeather && cacheWeather.current) {
      state.weather.current=cacheWeather.current; state.weather.hourly=cacheWeather.hourly||[]; state.weather.daily=cacheWeather.daily||null;
      state.weather.updatedAt=Number(cacheWeather.updatedAt||0); state.weather.ready=true;
    }
    var cacheCalendar = storeRead("calendar-cache", null);
    if (cacheCalendar && Array.isArray(cacheCalendar.events)) {
      state.calendar.events=cacheCalendar.events.map(deserializeEvent).filter(Boolean);
      state.calendar.updatedAt=Number(cacheCalendar.updatedAt||0); state.calendar.ready=true;
    }

    if (state.preview) {
      installPreviewSensors();
      var now = Date.now();
      state.calendar.events = [
        {start:new Date(now+38*60000),end:new Date(now+98*60000),summary:"Weekly coaching",location:"Discord",allDay:false},
        {start:new Date(now+160*60000),end:new Date(now+220*60000),summary:"Deep work block",location:"",allDay:false}
      ];
      state.calendar.ready = true;
    }

    // Nothing supplied by the native host is allowed to block the shell. The UI,
    // navigation, clock and timers become ready first; every provider starts later
    // through optionalRuntime and may fail independently without freezing the widget.
    renderAll();
    startTimers();
    state.started = true;
    state.startAttempts = 0;
    document.body.setAttribute("data-runtime", "ready");

    if (!state.preview) optionalRuntime("discover sensors", discoverSensors);
    optionalRuntime("initial sensor poll", pollSensors);
    optionalRuntime("initial FPS poll", pollFps);
    optionalRuntime("initial media poll", pollMedia);
    optionalRuntime("initial network probe", probeNetwork);
    optionalRuntime("initial weather refresh", function(){ return refreshWeather(true); });
    optionalRuntime("initial calendar refresh", function(){ return refreshCalendar(true); });
    renderAll();
  } catch (error) {
    state.started = false;
    document.body.setAttribute("data-runtime", "retrying");
    runtimeWarning("bootstrap", error);
    scheduleStartRetry();
  } finally {
    state.starting = false;
  }
}

var icueEvents = globalThis.icueEvents = {
  onICUEInitialized: function () {
    start();
    try { syncSettings(true); } catch (e) { runtimeWarning("iCUE settings sync", e); }
    optionalRuntime("iCUE weather refresh", function(){ return refreshWeather(true); });
    optionalRuntime("iCUE calendar refresh", function(){ return refreshCalendar(true); });
    optionalRuntime("iCUE sensor discovery", function(){ return Promise.resolve(discoverSensors()).then(pollSensors); });
    optionalRuntime("iCUE FPS poll", pollFps);
    optionalRuntime("iCUE media poll", pollMedia);
  },
  onDataUpdated: function () {
    try { syncSettings(true); } catch (e) { runtimeWarning("iCUE data update", e); }
  }
};

var pluginSensorsdataproviderEvents = globalThis.pluginSensorsdataproviderEvents = {
  onInitialized: function () { optionalRuntime("sensor provider init", function(){ return Promise.resolve(discoverSensors()).then(pollSensors); }); }
};
var pluginFpsdataproviderEvents = globalThis.pluginFpsdataproviderEvents = {
  onInitialized: function () { optionalRuntime("FPS provider init", pollFps); }
};
var pluginMediadataproviderEvents = globalThis.pluginMediadataproviderEvents = {
  onInitialized: function () { optionalRuntime("media provider init", pollMedia); }
};

try {
  if (typeof iCUE_initialized !== "undefined" && iCUE_initialized) icueEvents.onICUEInitialized();
} catch (e) { runtimeWarning("initial iCUE callback", e); }
try {
  if (typeof pluginSensorsdataprovider_initialized !== "undefined" && pluginSensorsdataprovider_initialized) pluginSensorsdataproviderEvents.onInitialized();
} catch (e2) { runtimeWarning("initial sensor callback", e2); }
try {
  if (typeof pluginFpsdataprovider_initialized !== "undefined" && pluginFpsdataprovider_initialized) pluginFpsdataproviderEvents.onInitialized();
} catch (e3) { runtimeWarning("initial FPS callback", e3); }
try {
  if (typeof pluginMediadataprovider_initialized !== "undefined" && pluginMediadataprovider_initialized) pluginMediadataproviderEvents.onInitialized();
} catch (e4) { runtimeWarning("initial media callback", e4); }

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
else start();
