/* Primary Calendar Panel parser.
 * Ports the Calendar Sync Pro shared parser behavior recovered from the shipped bundle and uses
 * the exact ical.js 2.2.1 distribution shipped with Calendar Sync Pro.
 */
var parseCalendarFallback = typeof parseCalendar === "function" ? parseCalendar : null;

function icalCancelled(component) {
  var status = component.getFirstPropertyValue("status");
  return typeof status === "string" && status.toUpperCase() === "CANCELLED";
}

function icalRegisterTimezones(root) {
  var zones = root.getAllSubcomponents("vtimezone");
  for (var i = 0; i < zones.length; i++) {
    try {
      var zone = new ICAL.Timezone(zones[i]);
      if (zone.tzid && !ICAL.TimezoneService.has(zone.tzid)) ICAL.TimezoneService.register(zone);
    } catch (error) {}
  }
}

function icalValidIntlZone(zone) {
  try { new Intl.DateTimeFormat("en-US", { timeZone: zone }); return true; }
  catch (error) { return false; }
}

function icalFallbackZone(component) {
  var start = component.getFirstProperty("dtstart");
  if (!start) return null;
  var tzid = start.getParameter("tzid");
  if (typeof tzid !== "string" || !tzid) return null;
  if (ICAL.TimezoneService.has(tzid)) return null;
  return icalValidIntlZone(tzid) ? tzid : null;
}

function icalIntlOffset(ms, zone) {
  var parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).formatToParts(new Date(ms));
  function value(type) {
    var found = parts.find(function (part) { return part.type === type; });
    return Number(found ? found.value : "0");
  }
  var hour = value("hour") % 24;
  return Date.UTC(value("year"), value("month") - 1, value("day"), hour, value("minute"), value("second")) - ms;
}

function icalTimeMs(time, fallbackZone) {
  if (!fallbackZone) return time.toJSDate().getTime();
  var raw = Date.UTC(time.year, time.month - 1, time.day, time.hour, time.minute, time.second);
  var first = raw - icalIntlOffset(raw, fallbackZone);
  return raw - icalIntlOffset(first, fallbackZone);
}

function icalLocalDateMs(time) {
  return new Date(time.year, time.month - 1, time.day).getTime();
}

function icalDateKey(time) {
  return String(time.year) + pad2(time.month) + pad2(time.day);
}

function icalNormalize(event, startTime, endTime, fallbackZone, sourceIndex, recurrenceKey) {
  var allDay = startTime.isDate === true;
  var component = event.component;
  var startMs = allDay ? icalLocalDateMs(startTime) : icalTimeMs(startTime, fallbackZone);
  var endMs = allDay ? icalLocalDateMs(endTime) : icalTimeMs(endTime, fallbackZone);
  var uid = event.uid || "";
  return {
    id: uid + ":" + (recurrenceKey || String(startMs)),
    uid: uid,
    title: String(event.summary || "").trim() || "Busy",
    location: String(event.location || "").trim(),
    description: String(event.description || "").trim(),
    allDay: allDay,
    allDayStart: allDay ? icalDateKey(startTime) : null,
    allDayEndExclusive: allDay ? icalDateKey(endTime) : null,
    start: allDay ? null : new Date(startMs),
    end: allDay ? null : new Date(endMs),
    sourceIndex: sourceIndex,
    recurrenceKey: recurrenceKey || (allDay ? icalDateKey(startTime) : String(startMs)),
    _startMs: startMs,
    _endMs: endMs,
    _component: component
  };
}

function icalIntersects(event, fromMs, toMs) {
  return event._endMs > fromMs && event._startMs <= toMs;
}

function icalDedupe(events) {
  var map = new Map();
  events.forEach(function (event) {
    var key = event.uid + "@" + event._startMs;
    if (!map.has(key)) map.set(key, event);
  });
  return Array.from(map.values()).sort(function (a, b) {
    return a._startMs - b._startMs || a.title.localeCompare(b.title);
  });
}

function icalPublicEvent(event) {
  delete event._startMs;
  delete event._endMs;
  delete event._component;
  return event;
}

function icalExpandMaster(component, exceptions, bounds, sourceIndex) {
  if (icalCancelled(component)) return [];
  var event = new ICAL.Event(component);
  var uid = event.uid || "";
  var fallbackZone = icalFallbackZone(component);

  if (!event.isRecurring()) {
    var single = icalNormalize(event, event.startDate, event.endDate, fallbackZone, sourceIndex, "single");
    return icalIntersects(single, bounds.from, bounds.to) ? [single] : [];
  }

  for (var i = 0; i < exceptions.length; i++) {
    if (exceptions[i].getFirstPropertyValue("uid") !== uid) continue;
    try { event.relateException(new ICAL.Event(exceptions[i])); } catch (error) {}
  }

  var output = [];
  var iterator = event.iterator();
  var occurrence;
  var count = 0;
  while ((occurrence = iterator.next()) && count++ < 10000) {
    var details = event.getOccurrenceDetails(occurrence);
    if (icalCancelled(details.item.component)) continue;
    var item = new ICAL.Event(details.item.component);
    var normalized = icalNormalize(item, details.startDate, details.endDate, fallbackZone, sourceIndex, occurrence.toString());
    if (normalized._startMs > bounds.to) break;
    if (icalIntersects(normalized, bounds.from, bounds.to)) output.push(normalized);
  }
  return output;
}

function parseCalendarIcal(raw, sourceIndex, options) {
  if (!globalThis.ICAL) throw new Error("ical.js unavailable");
  var opts = options || {};
  var nowMs = opts.nowMs === undefined ? Date.now() : Number(opts.nowMs);
  var fromMs = nowMs - (opts.backMs === undefined ? 43200000 : Number(opts.backMs));
  var toMs = nowMs + (opts.aheadMs === undefined ? 2592000000 : Number(opts.aheadMs));
  var root = new ICAL.Component(ICAL.parse(String(raw || "")));
  icalRegisterTimezones(root);
  var components = root.getAllSubcomponents("vevent");
  var masters = [];
  var exceptions = [];
  components.forEach(function (component) {
    if (component.hasProperty("recurrence-id")) exceptions.push(component);
    else masters.push(component);
  });
  var expanded = [];
  masters.forEach(function (component) {
    try {
      expanded = expanded.concat(icalExpandMaster(component, exceptions, { from: fromMs, to: toMs }, sourceIndex));
    } catch (error) {}
  });
  return icalDedupe(expanded).slice(0, 200).map(icalPublicEvent);
}

function parseCalendar(raw, sourceIndex) {
  try { return parseCalendarIcal(raw, sourceIndex); }
  catch (error) {
    if (parseCalendarFallback) return parseCalendarFallback(raw, sourceIndex);
    throw error;
  }
}
