function compactEventsForDay(day) {
  return STATE.events.filter(function (event) { return event.allDay ? allDayActiveOn(event, day) : timedIntersectsDay(event, day); });
}

function renderCompact(days, onlyDay) {
  var list = document.getElementById("compactList");
  list.innerHTML = "";
  var targetDays = onlyDay ? [onlyDay] : days;
  var shown = 0;
  targetDays.forEach(function (day) {
    var events = compactEventsForDay(day);
    if (!events.length && STATE.mode === "today" && !onlyDay) return;
    var section = document.createElement("div");
    section.className = "compactDay";
    var header = document.createElement("div");
    header.className = "compactDayHeader";
    header.textContent = formatDayLong(day);
    section.appendChild(header);
    var slot = document.body.getAttribute("data-slot") || "s-h";
    var limit = targetDays.length > 1 ? 4 : 7;
    if (slot === "s-h") limit = 4;
    else if (slot === "s-v") limit = 4;
    events.slice(0, limit).forEach(function (event) {
      shown++;
      var button = document.createElement("button");
      button.type = "button";
      button.className = "compactEvent interactive" + ((!event.allDay && event.end.getTime() <= Date.now()) ? " past" : "");
      var time = document.createElement("span");
      time.className = "compactTime";
      time.textContent = event.allDay ? "ALL DAY" : formatTime(event.start);
      var title = document.createElement("span");
      title.className = "compactTitle";
      title.textContent = event.title;
      button.appendChild(time);
      button.appendChild(title);
      button.onclick = function () { openDetail(event); };
      section.appendChild(button);
    });
    list.appendChild(section);
  });
  if (!shown) {
    var section = document.createElement("div");
    section.className = "compactDay";
    var header = document.createElement("div");
    header.className = "compactDayHeader";
    header.textContent = STATE.status === "unconfigured" ? "SETUP" : "AGENDA";
    var empty = document.createElement("div");
    empty.className = "compactEvent";
    empty.innerHTML = '<span class="compactTime">' + (STATE.status === "unconfigured" ? "ICS" : "CLEAR") + '</span><span class="compactTitle">' + (STATE.status === "unconfigured" ? "Add a feed URL in settings" : "No events here") + '</span>';
    section.appendChild(header);
    section.appendChild(empty);
    list.appendChild(section);
  }
}

function renderCompactOnly(day) {
  renderCompact([day], day);
}

function openDaySummary(day) {
  var events = STATE.events.filter(function (event) {
    return event.allDay ? allDayActiveOn(event, day) : timedIntersectsDay(event, day);
  }).sort(compareEvents);
  STATE.selected = null;
  var overlay = document.getElementById("detailOverlay");
  overlay.classList.add("open");
  overlay.setAttribute("aria-hidden", "false");
  setText("detailTitle", formatDayLong(day));
  setText("detailTime", events.length + (events.length === 1 ? " event" : " events"));
  setText("detailLocation", "");
  setText("detailDescription", events.map(function (event) {
    var when = event.allDay ? "ALL DAY" : formatRange(event);
    return when + "  " + event.title + (event.location ? "\n" + event.location : "");
  }).join("\n\n"));
}

function openAllDaySummary(events) {
  STATE.selected = null;
  var overlay = document.getElementById("detailOverlay");
  overlay.classList.add("open");
  overlay.setAttribute("aria-hidden", "false");
  setText("detailTitle", "All day events");
  setText("detailTime", events.length + (events.length === 1 ? " event" : " events"));
  setText("detailLocation", "");
  setText("detailDescription", events.map(function (event) {
    return formatDayShort(allDayStartDate(event)) + "  " + event.title + (event.location ? "\n" + event.location : "");
  }).join("\n\n"));
}

function openDetail(event) {
  STATE.selected = event;
  var overlay = document.getElementById("detailOverlay");
  overlay.classList.add("open");
  overlay.setAttribute("aria-hidden", "false");
  setText("detailTitle", event.title);
  if (event.allDay) setText("detailTime", formatDayLong(allDayStartDate(event)) + " • All day");
  else setText("detailTime", formatDayLong(event.start) + " • " + formatRange(event));
  setText("detailLocation", event.location || "");
  setText("detailDescription", event.description || "");
}

function closeDetail() {
  STATE.selected = null;
  var overlay = document.getElementById("detailOverlay");
  overlay.classList.remove("open");
  overlay.setAttribute("aria-hidden", "true");
}

function render() {
  applyAppearance();
  renderStatus();
  var now = new Date();
  var days = visibleDays(now);
  setText("dayLabel", formatDayLong(now).toUpperCase());
  renderHero(now);
  renderTimeline(now, days);
  renderCompact(days, null);
}

function minuteTick() {
  render();
  if (CLOCK_TIMER) clearTimeout(CLOCK_TIMER);
  CLOCK_TIMER = setTimeout(minuteTick, 15000);
}

async function translateStatic() {
  var keys = ["CALENDAR", "NEXT UP", "ALL DAY", "TAP FOR NEXT 3 DAYS", "Refresh calendar", "Switch calendar range", "Day timeline", "Agenda list", "Close details", "EVENT"];
  var values = await Promise.all(keys.map(t));
  var map = {};
  keys.forEach(function (key, index) { map[key] = values[index]; });
  setText("brandLabel", map["CALENDAR"]);
  setText("heroEyebrow", map["NEXT UP"]);
  setText("allDayLabel", map["ALL DAY"]);
  setText("heroToggle", map["TAP FOR NEXT 3 DAYS"]);
  setText("detailEyebrow", map["EVENT"]);
  document.getElementById("refreshButton").setAttribute("aria-label", map["Refresh calendar"]);
  document.getElementById("heroCard").setAttribute("aria-label", map["Switch calendar range"]);
  document.getElementById("timelinePanel").setAttribute("aria-label", map["Day timeline"]);
  document.getElementById("compactAgenda").setAttribute("aria-label", map["Agenda list"]);
  document.getElementById("detailClose").setAttribute("aria-label", map["Close details"]);
}

var BOOTED = false;
var LAST_ICUE_PROPERTIES = null;

function readIcuePropertySnapshot() {
  return {
    calendarUrl1: String(getIcueProperty("calendarUrl1", "") || ""),
    calendarUrl2: String(getIcueProperty("calendarUrl2", "") || ""),
    calendarUrl3: String(getIcueProperty("calendarUrl3", "") || ""),
    refreshMinutes: Number(getIcueProperty("refreshMinutes", 15)) || 15,
    use24Hour: getIcueProperty("use24Hour", false) === true,
    textColor: String(getIcueProperty("textColor", "#F4F6F8") || "#F4F6F8"),
    accentColor: String(getIcueProperty("accentColor", "#2BE86A") || "#2BE86A"),
    backgroundColor: String(getIcueProperty("backgroundColor", "#07090D") || "#07090D")
  };
}

function calendarPropertiesChanged(previous, current) {
  if (!previous) return true;
  return previous.calendarUrl1 !== current.calendarUrl1 ||
    previous.calendarUrl2 !== current.calendarUrl2 ||
    previous.calendarUrl3 !== current.calendarUrl3;
}

function onIcueInitialized() {
  if (!BOOTED) boot();
  else {
    LAST_ICUE_PROPERTIES = readIcuePropertySnapshot();
    applySlot();
    refreshCalendars(true);
  }
}

function onIcueDataUpdated() {
  if (!BOOTED) { boot(); return; }
  var previous = LAST_ICUE_PROPERTIES;
  var current = readIcuePropertySnapshot();
  LAST_ICUE_PROPERTIES = current;
  applySlot();
  translateStatic();
  if (calendarPropertiesChanged(previous, current)) refreshCalendars(true);
  else {
    render();
    if (!previous || previous.refreshMinutes !== current.refreshMinutes) scheduleRefresh();
  }
}

function installIcueEvents() {
  try {
    globalThis.icueEvents = {
      onICUEInitialized: onIcueInitialized,
      onDataUpdated: onIcueDataUpdated
    };
  } catch (error) {}
}

function boot() {
  if (BOOTED) return;
  BOOTED = true;
  LAST_ICUE_PROPERTIES = readIcuePropertySnapshot();
  var cached = cacheRead();
  if (cached && cached.events.length) {
    STATE.events = cached.events;
    STATE.updatedAt = cached.updatedAt || 0;
    STATE.stale = true;
    STATE.status = "stale";
  }
  document.getElementById("refreshButton").onclick = function () { refreshCalendars(true); };
  document.getElementById("detailClose").onclick = closeDetail;
  window.addEventListener("resize", applySlot);
  document.addEventListener("keydown", function (event) { if (event.key === "Escape") closeDetail(); });
  applySlot();
  translateStatic();
  refreshCalendars(true);
  minuteTick();
}

installIcueEvents();
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();

try {
  if (typeof iCUE_initialized !== "undefined" && iCUE_initialized) onIcueInitialized();
} catch (error) {}
