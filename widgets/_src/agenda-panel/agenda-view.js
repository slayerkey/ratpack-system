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

function boot() {
  try { globalThis.icueEvents = globalThis.icueEvents || function () {}; } catch (error) {}
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

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
