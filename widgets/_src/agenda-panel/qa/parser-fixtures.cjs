const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const path = require('path');
const base = path.resolve(__dirname, '..') + path.sep;
const code = ['agenda-core.js', 'agenda-recur.js'].map((file) => fs.readFileSync(base + file, 'utf8')).join('\n');
const sandbox = {
  console, Date, Intl, Math, JSON, Number, String, Array, Object, RegExp, Promise, Map, Set,
  setTimeout, clearTimeout, URL, globalThis: null,
  document: { readyState: 'loading', addEventListener() {}, documentElement: { clientWidth: 840, clientHeight: 696, style: { setProperty() {} } } },
  window: { innerWidth: 840, innerHeight: 696, addEventListener() {} },
  localStorage: { getItem() { return null; }, setItem() {} }, fetch() { return Promise.resolve(null); },
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

const pad = (n) => String(n).padStart(2, '0');
const now = new Date();
const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
const day2 = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2);
const ymd = (d) => d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate());
const dt = (d, h, m = 0) => `${ymd(d)}T${pad(h)}${pad(m)}00`;
const ics = (body) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//PackRat Fallback QA//EN\r\n${body}\r\nEND:VCALENDAR\r\n`;

const raw = ics([
  'BEGIN:VEVENT', 'UID:weekly', 'SUMMARY:Weekly', `DTSTART:${dt(today, 10)}`, `DTEND:${dt(today, 11)}`,
  'RRULE:FREQ=DAILY;COUNT=4', `EXDATE:${dt(tomorrow, 10)}`, 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:weekly', `RECURRENCE-ID:${dt(day2, 10)}`, 'SUMMARY:Moved', `DTSTART:${dt(day2, 14)}`, `DTEND:${dt(day2, 15)}`, 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:allday', 'SUMMARY:All day', `DTSTART;VALUE=DATE:${ymd(today)}`, `DTEND;VALUE=DATE:${ymd(tomorrow)}`, 'END:VEVENT',
].join('\r\n'));
const events = sandbox.parseCalendar(raw, 0);
assert(events.some((e) => e.uid === 'allday' && e.allDay && e.allDayStart === ymd(today) && e.allDayEndExclusive === ymd(tomorrow)), 'all day exclusive DTEND');
assert(!events.some((e) => e.uid === 'weekly' && !e.allDay && e.start.getDate() === tomorrow.getDate() && e.start.getHours() === 10), 'EXDATE removed');
assert(events.some((e) => e.uid === 'weekly' && e.title === 'Moved' && e.start.getDate() === day2.getDate() && e.start.getHours() === 14), 'RECURRENCE-ID moved occurrence');

const before = sandbox.zonedPartsToDate({ y: 2026, m: 3, d: 7, h: 9, min: 0, s: 0 }, 'America/New_York');
const after = sandbox.zonedPartsToDate({ y: 2026, m: 3, d: 9, h: 9, min: 0, s: 0 }, 'America/New_York');
assert(before && after, 'DST dates convert');
assert.strictEqual(after - before, 47 * 3600000, 'wall time remains 9 AM across spring DST');

console.log('FALLBACK PARSER FIXTURES PASS');
