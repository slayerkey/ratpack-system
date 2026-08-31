function renderAll() {
  var cfg = settings();
  renderHealth(); renderWeather(); renderAgenda(); renderNetwork(); renderFocus(); renderContext();
  setText("smartPerfState", cfg.smartMode && cfg.startMode === "auto" ? (Date.now()<state.manualHoldUntil?"HOLD":"AUTO") : "MANUAL");
  drawPerformanceGraph(); drawNetworkSpark(); drawWeatherSpark();
}

function bindUi() {
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
}

function startTimers() {
  state.timers.push(setInterval(syncSettings,250));
  state.timers.push(setInterval(updateClock,1000));
  state.timers.push(setInterval(pollSensors,1000));
  state.timers.push(setInterval(pollFps,1000));
  state.timers.push(setInterval(pollMedia,1500));
  state.timers.push(setInterval(probeNetwork,5000));
  state.timers.push(setInterval(function(){refreshWeather(false);}, 10*60*1000));
  state.timers.push(setInterval(function(){refreshCalendar(false);}, 8*60*1000));
}

async function start() {
  if (state.started) return;
  state.started = true;
  state.preview = isPreview();
  applySlot();
  bindUi();
  applySettings(true);
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
  } else {
    await discoverSensors();
  }
  await Promise.all([pollSensors(),pollFps(),pollMedia(),probeNetwork()]);
  refreshWeather(true);
  refreshCalendar(true);
  renderAll();
  startTimers();
}

var icueEvents = globalThis.icueEvents = {
  onICUEInitialized: function () {
    start();
    syncSettings(true);
    refreshWeather(true);
    refreshCalendar(true);
    discoverSensors().then(pollSensors);
    pollFps();
    pollMedia();
  },
  onDataUpdated: function () {
    syncSettings(true);
  }
};

var pluginSensorsdataproviderEvents = globalThis.pluginSensorsdataproviderEvents = {
  onInitialized: function () { discoverSensors().then(pollSensors); }
};
var pluginFpsdataproviderEvents = globalThis.pluginFpsdataproviderEvents = {
  onInitialized: function () { pollFps(); }
};
var pluginMediadataproviderEvents = globalThis.pluginMediadataproviderEvents = {
  onInitialized: function () { pollMedia(); }
};

try {
  if (typeof iCUE_initialized !== "undefined" && iCUE_initialized) icueEvents.onICUEInitialized();
} catch (e) {}
try {
  if (typeof pluginSensorsdataprovider_initialized !== "undefined" && pluginSensorsdataprovider_initialized) pluginSensorsdataproviderEvents.onInitialized();
} catch (e2) {}
try {
  if (typeof pluginFpsdataprovider_initialized !== "undefined" && pluginFpsdataprovider_initialized) pluginFpsdataproviderEvents.onInitialized();
} catch (e3) {}
try {
  if (typeof pluginMediadataprovider_initialized !== "undefined" && pluginMediadataprovider_initialized) pluginMediadataproviderEvents.onInitialized();
} catch (e4) {}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
else start();
