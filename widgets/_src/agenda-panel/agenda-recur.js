function daysInMonth(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); }
function addPlainDays(parts, amount) {
  var d = new Date(Date.UTC(parts.y, parts.m - 1, parts.d + amount));
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), h: parts.h || 0, min: parts.min || 0, s: parts.s || 0 };
}
function plainDayNumber(parts) { return Math.floor(Date.UTC(parts.y, parts.m - 1, parts.d) / 86400000); }
function plainWeekday(parts) { return new Date(Date.UTC(parts.y, parts.m - 1, parts.d)).getUTCDay(); }
function plainMonthsBetween(a, b) { return (b.y - a.y) * 12 + (b.m - a.m); }
function comparePlain(a, b) { return plainDayNumber(a) - plainDayNumber(b); }

var WEEKDAY = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
function parseByDay(value) {
  return String(value || "").split(",").filter(Boolean).map(function (token) {
    var match = token.match(/^([+-]?\d+)?(SU|MO|TU|WE|TH|FR|SA)$/i);
    return match ? { ordinal: match[1] ? Number(match[1]) : 0, day: WEEKDAY[match[2].toUpperCase()] } : null;
  }).filter(Boolean);
}

function parseRrule(text) {
  var rule = { freq: "", interval: 1, count: null, until: null, byday: [], bymonthday: [], bymonth: [], wkst: 1 };
  String(text || "").split(";").forEach(function (part) {
    var eq = part.indexOf("=");
    if (eq < 0) return;
    var key = part.slice(0, eq).toUpperCase();
    var value = part.slice(eq + 1);
    if (key === "FREQ") rule.freq = value.toUpperCase();
    else if (key === "INTERVAL") rule.interval = Math.max(1, Number(value) || 1);
    else if (key === "COUNT") rule.count = Math.max(0, Number(value) || 0);
    else if (key === "UNTIL") rule.until = value;
    else if (key === "BYDAY") rule.byday = parseByDay(value);
    else if (key === "BYMONTHDAY") rule.bymonthday = value.split(",").map(Number).filter(Number.isFinite);
    else if (key === "BYMONTH") rule.bymonth = value.split(",").map(Number).filter(Number.isFinite);
    else if (key === "WKST" && WEEKDAY[value.toUpperCase()] !== undefined) rule.wkst = WEEKDAY[value.toUpperCase()];
  });
  return rule;
}

function weekStartDayNumber(parts, wkst) {
  var num = plainDayNumber(parts);
  var wd = plainWeekday(parts);
  var offset = (wd - wkst + 7) % 7;
  return num - offset;
}

function ordinalWeekdayMatch(candidate, byday) {
  var wd = plainWeekday(candidate);
  var matching = byday.filter(function (item) { return item.day === wd; });
  if (!matching.length) return false;
  for (var i = 0; i < matching.length; i++) {
    var ordinal = matching[i].ordinal;
    if (!ordinal) return true;
    if (ordinal > 0) {
      var nth = Math.floor((candidate.d - 1) / 7) + 1;
      if (nth === ordinal) return true;
    } else {
      var dim = daysInMonth(candidate.y, candidate.m);
      var fromEnd = Math.floor((dim - candidate.d) / 7) + 1;
      if (-fromEnd === ordinal) return true;
    }
  }
  return false;
}

function monthlyRuleMatch(start, candidate, rule) {
  var diff = plainMonthsBetween(start, candidate);
  if (diff < 0 || diff % rule.interval !== 0) return false;
  if (rule.bymonth.length && rule.bymonth.indexOf(candidate.m) < 0) return false;
  if (rule.bymonthday.length) {
    var dim = daysInMonth(candidate.y, candidate.m);
    var valid = rule.bymonthday.some(function (day) { return day > 0 ? candidate.d === day : candidate.d === dim + day + 1; });
    if (!valid) return false;
  } else if (rule.byday.length) {
    if (!ordinalWeekdayMatch(candidate, rule.byday)) return false;
  } else if (candidate.d !== start.d) return false;
  return true;
}

function recurrenceDateMatches(start, candidate, rule) {
  if (comparePlain(candidate, start) < 0) return false;
  if (rule.bymonth.length && rule.bymonth.indexOf(candidate.m) < 0) return false;
  if (rule.freq === "DAILY") {
    if ((plainDayNumber(candidate) - plainDayNumber(start)) % rule.interval !== 0) return false;
    if (rule.byday.length && !ordinalWeekdayMatch(candidate, rule.byday)) return false;
    if (rule.bymonthday.length) {
      var dim = daysInMonth(candidate.y, candidate.m);
      if (!rule.bymonthday.some(function (day) { return day > 0 ? candidate.d === day : candidate.d === dim + day + 1; })) return false;
    }
    return true;
  }
  if (rule.freq === "WEEKLY") {
    var weekDiff = Math.floor((weekStartDayNumber(candidate, rule.wkst) - weekStartDayNumber(start, rule.wkst)) / 7);
    if (weekDiff < 0 || weekDiff % rule.interval !== 0) return false;
    var days = rule.byday.length ? rule.byday.map(function (item) { return item.day; }) : [plainWeekday(start)];
    return days.indexOf(plainWeekday(candidate)) >= 0;
  }
  if (rule.freq === "MONTHLY") return monthlyRuleMatch(start, candidate, rule);
  if (rule.freq === "YEARLY") {
    var years = candidate.y - start.y;
    if (years < 0 || years % rule.interval !== 0) return false;
    if (!rule.bymonth.length && candidate.m !== start.m) return false;
    if (rule.bymonthday.length || rule.byday.length) return monthlyRuleMatch({ y: candidate.y, m: candidate.m, d: start.d }, candidate, { interval: 1, bymonth: rule.bymonth, bymonthday: rule.bymonthday, byday: rule.byday });
    return candidate.d === start.d;
  }
  return false;
}

function parseDurationMs(value) {
  var match = String(value || "").match(/^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i);
  if (!match) return 0;
  var sign = match[1] === "-" ? -1 : 1;
  var seconds = (Number(match[2] || 0) * 7 * 86400) + (Number(match[3] || 0) * 86400) + (Number(match[4] || 0) * 3600) + (Number(match[5] || 0) * 60) + Number(match[6] || 0);
  return sign * seconds * 1000;
}

function buildTemplate(component, aliases, sourceIndex) {
  var uid = propText(component, "UID", "uid-" + sourceIndex + "-" + Math.random().toString(36).slice(2));
  var startProp = prop(component, "DTSTART");
  var startValue = parseDateValue(startProp, aliases);
  if (!startValue) return null;
  var endProp = prop(component, "DTEND");
  var endValue = parseDateValue(endProp, aliases);
  var durationProp = prop(component, "DURATION");
  var allDay = startValue.allDay;
  var durationMs = 0;
  var allDaySpan = 1;
  if (allDay) {
    if (endValue && endValue.allDay) allDaySpan = Math.max(1, plainDayNumber(endValue.dateParts) - plainDayNumber(startValue.dateParts));
    else if (durationProp) allDaySpan = Math.max(1, Math.round(parseDurationMs(durationProp.value) / 86400000));
  } else {
    if (endValue && !endValue.allDay) durationMs = Math.max(0, endValue.date.getTime() - startValue.date.getTime());
    else if (durationProp) durationMs = Math.max(0, parseDurationMs(durationProp.value));
    if (!durationMs) durationMs = 30 * 60000;
  }
  var recurrenceIdProp = prop(component, "RECURRENCE-ID");
  var recurrenceId = recurrenceIdProp ? parseDateValue(recurrenceIdProp, aliases) : null;
  var rruleProp = prop(component, "RRULE");
  var status = propText(component, "STATUS", "").toUpperCase();
  return {
    component: component,
    uid: uid,
    title: propText(component, "SUMMARY", "Untitled event") || "Untitled event",
    location: propText(component, "LOCATION", ""),
    description: propText(component, "DESCRIPTION", ""),
    startValue: startValue,
    allDay: allDay,
    durationMs: durationMs,
    allDaySpan: allDaySpan,
    recurrenceId: recurrenceId,
    rule: rruleProp ? parseRrule(rruleProp.value) : null,
    rdates: props(component, "RDATE"),
    exdates: props(component, "EXDATE"),
    status: status,
    sourceIndex: sourceIndex
  };
}

function valueToOccurrenceKey(value) {
  if (!value) return "";
  if (value.allDay) return "D:" + dateKey(value.dateParts);
  return "T:" + value.date.getTime();
}

function wallPartsToOccurrenceDate(template, wallDate) {
  var original = template.startValue.parts || { h: 0, min: 0, s: 0 };
  var parts = { y: wallDate.y, m: wallDate.m, d: wallDate.d, h: original.h || 0, min: original.min || 0, s: original.s || 0 };
  var zone = template.startValue.zone;
  if (zone === "UTC") return new Date(Date.UTC(parts.y, parts.m - 1, parts.d, parts.h, parts.min, parts.s));
  if (zone && typeof zone === "object" && zone.type === "vtimezone") {
    var embedded = vtimezonePartsToDate(parts, zone);
    if (embedded) return embedded;
  } else if (zone && zone !== "floating") {
    var zoned = zonedPartsToDate(parts, zone);
    if (zoned) return zoned;
  }
  return new Date(parts.y, parts.m - 1, parts.d, parts.h, parts.min, parts.s);
}

function templateOccurrence(template, wallDate, keySuffix) {
  if (template.allDay) {
    var endParts = addPlainDays(wallDate, template.allDaySpan);
    return {
      id: template.uid + ":" + (keySuffix || dateKey(wallDate)), uid: template.uid,
      title: template.title, location: template.location, description: template.description,
      allDay: true, allDayStart: dateKey(wallDate), allDayEndExclusive: dateKey(endParts),
      start: null, end: null, sourceIndex: template.sourceIndex, recurrenceKey: keySuffix || dateKey(wallDate)
    };
  }
  var start = wallPartsToOccurrenceDate(template, wallDate);
  return {
    id: template.uid + ":" + (keySuffix || start.getTime()), uid: template.uid,
    title: template.title, location: template.location, description: template.description,
    allDay: false, allDayStart: null, allDayEndExclusive: null,
    start: start, end: new Date(start.getTime() + template.durationMs), sourceIndex: template.sourceIndex,
    recurrenceKey: keySuffix || String(start.getTime())
  };
}

function overrideOccurrence(template) {
  if (template.status === "CANCELLED") return null;
  if (template.allDay) return templateOccurrence(template, cloneParts(template.startValue.dateParts), valueToOccurrenceKey(template.recurrenceId));
  return templateOccurrence(template, cloneParts(template.startValue.parts), valueToOccurrenceKey(template.recurrenceId));
}

function listDateValues(items, aliases) {
  var out = [];
  items.forEach(function (item) {
    String(item.value || "").split(",").forEach(function (raw) {
      var clone = { name: item.name, params: item.params, value: raw };
      var parsed = parseDateValue(clone, aliases);
      if (parsed) out.push(parsed);
    });
  });
  return out;
}

function localPlainDate(date) { return { y: date.getFullYear(), m: date.getMonth() + 1, d: date.getDate() }; }
function dateKeyToParts(key) { return { y: Number(key.slice(0,4)), m: Number(key.slice(4,6)), d: Number(key.slice(6,8)) }; }

function visibleWindow() {
  var now = new Date();
  var start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  var end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 6);
  return { start: start, end: end, startPlain: localPlainDate(start), endPlain: localPlainDate(end) };
}

function eventIntersectsWindow(event, windowRange) {
  if (event.allDay) {
    return event.allDayEndExclusive > dateKey(windowRange.startPlain) && event.allDayStart < dateKey(windowRange.endPlain);
  }
  return event.end.getTime() > windowRange.start.getTime() && event.start.getTime() < windowRange.end.getTime();
}

function parseCalendar(raw, sourceIndex) {
  var root = parseComponents(raw);
  var aliases = collectTimezoneAliases(root);
  var events = [];
  function walk(component) {
    if (component.name === "VEVENT") events.push(component);
    component.children.forEach(walk);
  }
  walk(root);
  var templates = events.map(function (component) { return buildTemplate(component, aliases, sourceIndex); }).filter(Boolean);
  var masters = {};
  var overrides = {};
  templates.forEach(function (template) {
    if (template.recurrenceId) {
      if (!overrides[template.uid]) overrides[template.uid] = {};
      overrides[template.uid][valueToOccurrenceKey(template.recurrenceId)] = template;
    } else {
      if (!masters[template.uid]) masters[template.uid] = [];
      masters[template.uid].push(template);
    }
  });

  var range = visibleWindow();
  var result = [];
  var usedOverrides = {};
  Object.keys(masters).forEach(function (uid) {
    masters[uid].forEach(function (master) {
      if (master.status === "CANCELLED") return;
      if (!master.rule || !master.rule.freq) {
        var base = master.allDay ? templateOccurrence(master, cloneParts(master.startValue.dateParts)) : templateOccurrence(master, cloneParts(master.startValue.parts));
        var baseKey = master.allDay ? "D:" + dateKey(master.startValue.dateParts) : "T:" + base.start.getTime();
        var override = overrides[uid] && overrides[uid][baseKey];
        if (override) {
          usedOverrides[uid + "|" + baseKey] = true;
          var replaced = overrideOccurrence(override);
          if (replaced && eventIntersectsWindow(replaced, range)) result.push(replaced);
        } else if (eventIntersectsWindow(base, range)) result.push(base);
        return;
      }

      var startPlain = master.allDay ? cloneParts(master.startValue.dateParts) : { y: master.startValue.parts.y, m: master.startValue.parts.m, d: master.startValue.parts.d };
      var cursor = cloneParts(startPlain);
      var count = 0;
      var safety = 0;
      var exKeys = {};
      listDateValues(master.exdates, aliases).forEach(function (value) { exKeys[valueToOccurrenceKey(value)] = true; });
      var rValues = listDateValues(master.rdates, aliases);
      var untilValue = master.rule.until ? parseDateValue({ name: "UNTIL", params: {}, value: master.rule.until }, aliases) : null;

      while (comparePlain(cursor, range.endPlain) < 0 && safety < 20000) {
        safety++;
        if (recurrenceDateMatches(startPlain, cursor, master.rule)) {
          var occurrence = templateOccurrence(master, cursor);
          var occurrenceValue = master.allDay ? { allDay: true, dateParts: cloneParts(cursor) } : { allDay: false, date: occurrence.start };
          var occKey = valueToOccurrenceKey(occurrenceValue);
          var afterUntil = untilValue && (untilValue.allDay ? comparePlain(cursor, untilValue.dateParts) > 0 : occurrence.start.getTime() > untilValue.date.getTime());
          if (afterUntil) break;
          count++;
          if (master.rule.count !== null && count > master.rule.count) break;
          if (!exKeys[occKey]) {
            var foundOverride = overrides[uid] && overrides[uid][occKey];
            if (foundOverride) {
              usedOverrides[uid + "|" + occKey] = true;
              var replacement = overrideOccurrence(foundOverride);
              if (replacement && eventIntersectsWindow(replacement, range)) result.push(replacement);
            } else if (eventIntersectsWindow(occurrence, range)) result.push(occurrence);
          }
        }
        cursor = addPlainDays(cursor, 1);
      }

      rValues.forEach(function (value) {
        var rKey = valueToOccurrenceKey(value);
        if (exKeys[rKey]) return;
        var foundOverride = overrides[uid] && overrides[uid][rKey];
        if (foundOverride) {
          usedOverrides[uid + "|" + rKey] = true;
          var replacement = overrideOccurrence(foundOverride);
          if (replacement && eventIntersectsWindow(replacement, range)) result.push(replacement);
          return;
        }
        var wall = value.allDay ? value.dateParts : (value.parts || localPlainDate(value.date));
        var rOccurrence = templateOccurrence(master, cloneParts(wall), rKey);
        if (!master.allDay && value.date && (!master.startValue.zone || master.startValue.zone === "floating")) {
          rOccurrence.start = value.date;
          rOccurrence.end = new Date(value.date.getTime() + master.durationMs);
        }
        if (eventIntersectsWindow(rOccurrence, range)) result.push(rOccurrence);
      });
    });
  });

  Object.keys(overrides).forEach(function (uid) {
    Object.keys(overrides[uid]).forEach(function (key) {
      if (usedOverrides[uid + "|" + key]) return;
      var orphan = overrideOccurrence(overrides[uid][key]);
      if (orphan && eventIntersectsWindow(orphan, range)) result.push(orphan);
    });
  });

  result.sort(compareEvents);
  var dedupe = {};
  return result.filter(function (event) {
    var key = event.uid + "|" + (event.allDay ? event.allDayStart : event.start.getTime());
    if (dedupe[key]) return false;
    dedupe[key] = true;
    return true;
  });
}

function compareEvents(a, b) {
  if (a.allDay && !b.allDay) return -1;
  if (!a.allDay && b.allDay) return 1;
  var av = a.allDay ? Number(a.allDayStart) : a.start.getTime();
  var bv = b.allDay ? Number(b.allDayStart) : b.start.getTime();
  return av - bv || a.title.localeCompare(b.title);
}
