async function refreshCalendar(force) {
  var url = settings().calendarUrl;
  if (state.preview && !url && state.calendar.events.length) {
    state.calendar.ready = true; state.calendar.error = ""; renderAgenda(); renderContext(); return;
  }
  if (!url) {
    state.calendar.ready = false; state.calendar.error = "No calendar"; state.calendar.events = []; renderAgenda(); return;
  }
  if (state.calendar.loading) return;
  if (!force && state.calendar.ready && Date.now() - state.calendar.updatedAt < 10 * 60 * 1000) return;
  state.calendar.loading = true;
  try {
    var response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error("Calendar HTTP " + response.status);
    var text = await response.text();
    var events = parseIcs(text);
    state.calendar.events = events;
    state.calendar.ready = true;
    state.calendar.error = "";
    state.calendar.updatedAt = Date.now();
    storeWrite("calendar-cache", { events: events.map(serializeEvent), updatedAt: state.calendar.updatedAt });
  } catch (e) {
    var cache = storeRead("calendar-cache", null);
    if (cache && Array.isArray(cache.events) && Date.now() - Number(cache.updatedAt || 0) < 24 * 3600000) {
      state.calendar.events = cache.events.map(deserializeEvent).filter(Boolean);
      state.calendar.ready = true; state.calendar.error = "Cached"; state.calendar.updatedAt = Number(cache.updatedAt || 0);
    } else {
      state.calendar.ready = false; state.calendar.error = "Feed blocked"; state.calendar.events = [];
    }
  } finally {
    state.calendar.loading = false;
    renderAgenda(); renderContext();
  }
}

function serializeEvent(e) {
  return { start:e.start.toISOString(), end:e.end.toISOString(), summary:e.summary||"", location:e.location||"", allDay:!!e.allDay, uid:e.uid||"" };
}
function deserializeEvent(e) {
  try { return { start:new Date(e.start), end:new Date(e.end), summary:e.summary||"", location:e.location||"", allDay:!!e.allDay, uid:e.uid||"" }; }
  catch (err) { return null; }
}

function todayEvents() {
  var start = new Date(); start.setHours(0,0,0,0);
  var end = new Date(start.getTime() + 86400000);
  return state.calendar.events.filter(function (e) { return e.start < end && e.end > start; }).slice(0, 8);
}

function nextEvent() {
  var now = new Date();
  var candidates = state.calendar.events.filter(function (e) { return e.end > now; });
  return candidates.length ? candidates[0] : null;
}

function formatEventTime(e) {
  if (!e) return "";
  if (e.allDay) return "ALL DAY";
  return formatTime(e.start, false).replace(/ (AM|PM)$/," $1") + " – " + formatTime(e.end, false);
}

function renderAgenda() {
  var list = byId("agendaList"); if (!list) return;
  list.replaceChildren();
  var events = todayEvents();
  var next = nextEvent();
  if (!events.length) {
    var empty = document.createElement("div");
    empty.className = "emptyState";
    empty.textContent = state.calendar.loading ? "Loading calendar…" :
      state.calendar.error === "Feed blocked" ? "This calendar feed blocks direct widget access. The optional PackRat Bridge can transport it locally." :
      "Calendar is optional. Add an ICS URL in iCUE to populate your day.";
    list.appendChild(empty);
  } else {
    events.slice(0, 6).forEach(function (event) {
      var row = document.createElement("button");
      row.type = "button";
      row.className = "agendaEvent touchSurface" + (next && event.start.getTime() === next.start.getTime() && event.summary === next.summary ? " is-next" : "");
      var time = document.createElement("div"); time.className = "eventTime"; time.textContent = event.allDay ? "ALL DAY" : formatTime(event.start, false);
      var title = document.createElement("div"); title.className = "eventTitle"; title.textContent = event.summary || "Untitled event";
      var meta = document.createElement("div"); meta.className = "eventMeta"; meta.textContent = event.location || formatTime(event.end, false);
      row.appendChild(time); row.appendChild(title); row.appendChild(meta);
      row.addEventListener("click", function () { openEventDrawer(event); });
      list.appendChild(row);
    });
  }
  setText("agendaState", state.calendar.loading ? "SYNC" : state.calendar.error ? state.calendar.error.toUpperCase() : (state.calendar.ready ? "LIVE" : "LOCAL"));
  if (next) {
    setText("todayNextTitle", next.summary || "Untitled event");
    setText("todayNextTime", next.allDay ? "All day" : relativeEvent(next) + " • " + formatTime(next.start, false));
    setText("nextEventText", (next.summary || "Event") + " • " + relativeEvent(next));
  } else {
    setText("todayNextTitle", state.calendar.error === "Feed blocked" ? "Calendar feed needs Bridge" : "No calendar connected");
    setText("todayNextTime", state.calendar.error === "Feed blocked" ? "Direct browser access was blocked" : "Add an ICS URL in iCUE");
    setText("nextEventText", state.calendar.error === "Feed blocked" ? "Feed needs Bridge" : "No calendar");
  }
}
