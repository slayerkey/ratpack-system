function openDrawer(kicker,title,html) {
  setText("drawerKicker", kicker);
  setText("drawerTitle", title);
  byId("drawerBody").innerHTML = html;
  byId("drawer").hidden = false;
}
function closeDrawer() { byId("drawer").hidden = true; }

function openWeatherDrawer() {
  if (!state.weather.ready) {
    openDrawer("WEATHER","Weather setup","<div class='emptyState'>Add latitude and longitude in iCUE settings. Weather is fetched directly from Open-Meteo with no PackRat account.</div>");
    return;
  }
  var rows = state.weather.hourly.slice(0,8).map(function(h){
    return "<div class='detailRow'><span>" + new Date(h.at).toLocaleTimeString([], {hour:'numeric'}) + "</span><span>" +
      displayTemperature(h.temp) + "° • " + (h.rain === null ? "—" : Math.round(h.rain)+"% rain") + "</span></div>";
  }).join("");
  var daily = state.weather.daily || {};
  var high = daily.temperature_2m_max ? displayTemperature(finite(daily.temperature_2m_max[0]))+"°" : "—";
  var low = daily.temperature_2m_min ? displayTemperature(finite(daily.temperature_2m_min[0]))+"°" : "—";
  openDrawer("WEATHER","Next 8 hours",
    "<div class='detailStatGrid'><div class='detailStat'><span>HIGH</span><strong>"+high+"</strong></div><div class='detailStat'><span>LOW</span><strong>"+low+"</strong></div></div><div class='detailList'>"+rows+"</div>");
}

function openNetworkDrawer() {
  var n = state.network, history = state.history.network.slice(-60);
  var average = history.length ? Math.round(history.reduce(function(a,p){return a+p.value;},0)/history.length) : null;
  var loss = n.verified + n.failures ? Math.round(n.failures/(n.verified+n.failures)*100) : 0;
  openDrawer("NETWORK","Connection health",
    "<div class='detailStatGrid'>"+
    "<div class='detailStat'><span>RESPONSE</span><strong>"+(n.current===null?"—":n.current+" ms")+"</strong></div>"+
    "<div class='detailStat'><span>JITTER</span><strong>"+(n.jitter===null?"—":Math.round(n.jitter)+" ms")+"</strong></div>"+
    "<div class='detailStat'><span>5M AVG</span><strong>"+(average===null?"—":average+" ms")+"</strong></div>"+
    "<div class='detailStat'><span>PROBE FAIL</span><strong>"+loss+"%</strong></div>"+
    "</div><div class='emptyState' style='margin-top:1em'>Measures browser HTTPS response timing. It does not claim ICMP ping or literal packet loss.</div>");
}

function openMediaDrawer() {
  var title = state.media.title || "Nothing playing", artist = state.media.artist || "Windows system media";
  openDrawer("MEDIA", title,
    "<div class='detailStat'><span>ARTIST</span><strong>"+escapeHtml(artist)+"</strong></div>"+
    "<div class='mediaControls'>"+
    "<button type='button' id='drawerPrev' data-media-action='triggerPreviousTrack' aria-label='Previous track'>◀</button>"+
    "<button type='button' id='drawerPlay' data-media-action='triggerPlayPause' aria-label='Play or pause'>▶Ⅱ</button>"+
    "<button type='button' id='drawerNext' data-media-action='triggerNextTrack' aria-label='Next track'>▶</button>"+
    "</div>");
}

function openEventDrawer(event) {
  if (!event) return;
  openDrawer("CALENDAR", event.summary || "Event",
    "<div class='detailList'><div class='detailRow'><span>WHEN</span><span>"+escapeHtml(formatEventTime(event))+"</span></div>"+
    "<div class='detailRow'><span>LOCATION</span><span>"+escapeHtml(event.location || "—")+"</span></div></div>");
}

function openMetricDrawer(role) {
  var labels = {gpuTemp:"GPU temperature",cpuTemp:"CPU temperature",gpuLoad:"GPU load",cpuLoad:"CPU load"};
  var value = state.metrics[role];
  var isTemp = role.indexOf("Temp")>=0;
  var display = Number.isFinite(value) ? (isTemp ? tempText(value,true)+"°" : Math.round(value)+"%") : "—";
  var arr = windowSeries(role), min = arr.length ? Math.min.apply(null,arr.map(function(p){return p.value;})) : null, max = arr.length ? Math.max.apply(null,arr.map(function(p){return p.value;})) : null;
  openDrawer("PC HEALTH", labels[role] || "Metric",
    "<div class='detailStatGrid'><div class='detailStat'><span>NOW</span><strong>"+display+"</strong></div>"+
    "<div class='detailStat'><span>WINDOW</span><strong>"+escapeHtml(settings().graphWindow.toUpperCase())+"</strong></div></div>"+
    "<div class='detailList'><div class='detailRow'><span>LOW</span><span>"+(min===null?"—":(isTemp?tempText(min,true)+"°":Math.round(min)+"%"))+"</span></div>"+
    "<div class='detailRow'><span>HIGH</span><span>"+(max===null?"—":(isTemp?tempText(max,true)+"°":Math.round(max)+"%"))+"</span></div></div>");
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g,function(ch){return({"&":"&amp;","<":"&lt;"," >":"&gt;",'"':"&quot;","'":"&#39;"})[ch] || ch;});
}

function openAboutDrawer() {
  openDrawer("PACKRAT","XENEON EDGE Ultimate",
    "<div class='emptyState'>One native dashboard for the things that matter most: time, PC health, FPS history, weather, media, schedule, focus and connection quality. Smart Mode can enter Performance when a game is active. Core features work without a PackRat cloud service.</div>");
}

function openContextDrawer() {
  var target = byId("contextCard").getAttribute("data-drawer");
  if (target === "network") openNetworkDrawer();
  else if (target === "media") openMediaDrawer();
  else if (target === "weather") openWeatherDrawer();
  else if (target === "event") openEventDrawer(nextEvent());
  else if (target === "performance") setMode("performance", true);
  else openAboutDrawer();
}
