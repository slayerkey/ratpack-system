function parseIcsDate(value, params) {
  var raw = String(value || "").trim();
  if (!raw) return null;
  if (/^\d{8}$/.test(raw)) {
    return new Date(Number(raw.slice(0,4)), Number(raw.slice(4,6))-1, Number(raw.slice(6,8)), 0,0,0);
  }
  var m = raw.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/);
  if (!m) return null;
  if (m[7]) return new Date(Date.UTC(+m[1], +m[2]-1, +m[3], +m[4], +m[5], +(m[6]||0)));
  return new Date(+m[1], +m[2]-1, +m[3], +m[4], +m[5], +(m[6]||0));
}

function unescapeIcs(value) {
  return String(value || "").replace(/\\n/gi, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");
}

function unfoldIcs(text) {
  return String(text || "").replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "").split(/\r?\n/);
}

function parseRRule(value) {
  var out = {};
  String(value || "").split(";").forEach(function (part) {
    var p = part.split("="); if (p.length >= 2) out[p[0].toUpperCase()] = p.slice(1).join("=");
  });
  return out;
}

function expandRecurring(event, rangeStart, rangeEnd) {
  if (!event.rrule) return [event];
  var rule = parseRRule(event.rrule);
  var freq = rule.FREQ;
  if (freq !== "DAILY" && freq !== "WEEKLY") return [event];
  var interval = Math.max(1, Number(rule.INTERVAL) || 1);
  var until = rule.UNTIL ? parseIcsDate(rule.UNTIL, "") : null;
  var count = Math.max(0, Number(rule.COUNT) || 0);
  var duration = Math.max(0, event.end.getTime() - event.start.getTime());
  var instances = [];
  var cursor = new Date(event.start.getTime());
  var generated = 0;
  var weekdayMap = { SU:0, MO:1, TU:2, WE:3, TH:4, FR:5, SA:6 };
  var byday = rule.BYDAY ? rule.BYDAY.split(",").map(function (d) { return weekdayMap[d.replace(/[^A-Z]/g,"")]; }).filter(function (d) { return d !== undefined; }) : [];

  if (freq === "DAILY") {
    while (cursor < rangeEnd && generated < 500) {
      generated++;
      if ((!until || cursor <= until) && (!count || generated <= count) && cursor >= rangeStart) {
        instances.push({ start: new Date(cursor), end: new Date(cursor.getTime()+duration), summary:event.summary, location:event.location, allDay:event.allDay, uid:event.uid });
      }
      if ((until && cursor > until) || (count && generated >= count)) break;
      cursor = new Date(cursor.getTime() + interval * 86400000);
    }
  } else {
    var days = byday.length ? byday : [event.start.getDay()];
    var probe = new Date(Math.max(event.start.getTime(), rangeStart.getTime() - 7 * 86400000));
    probe.setHours(event.start.getHours(), event.start.getMinutes(), event.start.getSeconds(), 0);
    var guard = 0;
    while (probe < rangeEnd && guard++ < 800) {
      var weeksFromStart = Math.floor((probe.getTime() - event.start.getTime()) / (7 * 86400000));
      var sameWeek = weeksFromStart >= 0 && weeksFromStart % interval === 0;
      if (sameWeek && days.indexOf(probe.getDay()) >= 0 && probe >= event.start && (!until || probe <= until)) {
        generated++;
        if ((!count || generated <= count) && probe >= rangeStart) {
          instances.push({ start:new Date(probe), end:new Date(probe.getTime()+duration), summary:event.summary, location:event.location, allDay:event.allDay, uid:event.uid });
        }
        if (count && generated >= count) break;
      }
      probe = new Date(probe.getTime() + 86400000);
    }
  }
  return instances;
}

function parseIcs(text) {
  var lines = unfoldIcs(text), events = [], current = null;
  lines.forEach(function (line) {
    if (line === "BEGIN:VEVENT") { current = {}; return; }
    if (line === "END:VEVENT") {
      if (current && current.start && current.end) events.push(current);
      current = null; return;
    }
    if (!current) return;
    var colon = line.indexOf(":"); if (colon < 0) return;
    var left = line.slice(0, colon), value = line.slice(colon+1);
    var semicolon = left.indexOf(";"), name = (semicolon >= 0 ? left.slice(0,semicolon) : left).toUpperCase();
    var params = semicolon >= 0 ? left.slice(semicolon+1) : "";
    if (name === "DTSTART") { current.start = parseIcsDate(value, params); current.allDay = /VALUE=DATE/i.test(params) || /^\d{8}$/.test(value); }
    else if (name === "DTEND") current.end = parseIcsDate(value, params);
    else if (name === "SUMMARY") current.summary = unescapeIcs(value);
    else if (name === "LOCATION") current.location = unescapeIcs(value);
    else if (name === "UID") current.uid = value;
    else if (name === "RRULE") current.rrule = value;
    else if (name === "STATUS" && value.toUpperCase() === "CANCELLED") current.cancelled = true;
  });
  var start = new Date(); start.setHours(0,0,0,0);
  var end = new Date(start.getTime() + 4 * 86400000);
  var expanded = [];
  events.filter(function (e) { return !e.cancelled; }).forEach(function (event) {
    expandRecurring(event, start, end).forEach(function (x) { expanded.push(x); });
  });
  return expanded.sort(function (a,b) { return a.start - b.start; });
}
