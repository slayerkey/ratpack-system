const fs = require('fs');
const vm = require('vm');
const zlib = require('zlib');
const assert = require('assert');
const path = require('path');

const base = path.resolve(__dirname, '..') + path.sep;
const packed = Array.from({ length: 8 }, (_, i) => {
  const name = 'ical-pack-' + String(i + 1).padStart(2, '0') + '.js';
  const text = fs.readFileSync(base + name, 'utf8');
  const match = text.match(/push\((['"])([A-Za-z0-9+/=]+)\1\)/);
  assert(match, `packed ICAL payload missing in ${name}`);
  return match[2];
}).join('');
const icalSource = zlib.gunzipSync(Buffer.from(packed, 'base64')).toString('utf8');

const sandbox = {
  console, Date, Intl, Math, JSON, Number, String, Array, Object, RegExp, Promise, Map, Set,
  globalThis: null,
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(icalSource, sandbox);
assert(sandbox.ICAL, 'exact ical.js runtime failed to load');
const code = ['agenda-core.js', 'agenda-recur.js', 'agenda-ical.js']
  .map((file) => fs.readFileSync(base + file, 'utf8')).join('\n');
vm.runInContext(code, sandbox);

const pad = (n) => String(n).padStart(2, '0');
const now = new Date();
const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
const add = (n) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + n);
const ymd = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
const dt = (d, h, m = 0) => `${ymd(d)}T${pad(h)}${pad(m)}00`;
const ics = (body) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//PackRat Exact ICAL QA//EN\r\n${body}\r\nEND:VCALENDAR\r\n`;

let raw = ics([
  'BEGIN:VEVENT', 'UID:series', 'SUMMARY:Weekly', `DTSTART:${dt(today, 10)}`, `DTEND:${dt(today, 11)}`,
  'RRULE:FREQ=DAILY;COUNT=4', `EXDATE:${dt(add(1), 10)}`, `RDATE:${dt(add(4), 18, 30)}`, 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:series', `RECURRENCE-ID:${dt(add(2), 10)}`, 'SUMMARY:Moved',
  `DTSTART:${dt(add(2), 14)}`, `DTEND:${dt(add(2), 15)}`, 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:allday', 'SUMMARY:All day', `DTSTART;VALUE=DATE:${ymd(today)}`,
  `DTEND;VALUE=DATE:${ymd(add(1))}`, 'END:VEVENT',
].join('\r\n'));
let events = sandbox.parseCalendarIcal(raw, 0, { nowMs: today.getTime(), backMs: 86400000, aheadMs: 8 * 86400000 });
assert(events.some((e) => e.uid === 'allday' && e.allDay && e.allDayStart === ymd(today) && e.allDayEndExclusive === ymd(add(1))), 'all day exclusive DTEND');
assert(!events.some((e) => e.uid === 'series' && !e.allDay && e.start.getDate() === add(1).getDate() && e.start.getHours() === 10), 'EXDATE removed');
assert(events.some((e) => e.uid === 'series' && e.title === 'Moved' && e.start.getDate() === add(2).getDate() && e.start.getHours() === 14), 'RECURRENCE-ID moved occurrence');
assert(events.some((e) => e.uid === 'series' && e.start.getDate() === add(4).getDate() && e.start.getHours() === 18 && e.start.getMinutes() === 30), 'RDATE preserves exact clock time');

const cancel = ics([
  'BEGIN:VEVENT', 'UID:c', 'SUMMARY:Recurring', `DTSTART:${dt(today, 16)}`, `DTEND:${dt(today, 17)}`, 'RRULE:FREQ=DAILY;COUNT=3', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:c', `RECURRENCE-ID:${dt(add(1), 16)}`, `DTSTART:${dt(add(1), 16)}`, `DTEND:${dt(add(1), 17)}`,
  'STATUS:CANCELLED', 'SUMMARY:Cancelled', 'END:VEVENT',
].join('\r\n'));
events = sandbox.parseCalendarIcal(cancel, 0, { nowMs: today.getTime(), backMs: 86400000, aheadMs: 5 * 86400000 });
assert.strictEqual(events.filter((e) => e.uid === 'c').length, 2, 'cancelled recurrence removed');
assert(!events.some((e) => e.title === 'Cancelled'), 'cancelled recurrence hidden');

const vt = ics([
  'BEGIN:VTIMEZONE', 'TZID:Eastern Standard Time',
  'BEGIN:STANDARD', 'DTSTART:16011101T020000', 'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU', 'TZOFFSETFROM:-0400', 'TZOFFSETTO:-0500', 'END:STANDARD',
  'BEGIN:DAYLIGHT', 'DTSTART:16010302T020000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU', 'TZOFFSETFROM:-0500', 'TZOFFSETTO:-0400', 'END:DAYLIGHT', 'END:VTIMEZONE',
  'BEGIN:VEVENT', 'UID:vt', 'SUMMARY:Embedded', 'DTSTART;TZID=Eastern Standard Time:20260823T090000',
  'DTEND;TZID=Eastern Standard Time:20260823T100000', 'END:VEVENT',
].join('\r\n'));
const fixedNow = new Date('2026-08-22T00:00:00Z').getTime();
events = sandbox.parseCalendarIcal(vt, 0, { nowMs: fixedNow, backMs: 86400000, aheadMs: 4 * 86400000 });
const embedded = events.find((e) => e.uid === 'vt');
assert(embedded, 'embedded VTIMEZONE event');
assert.strictEqual(embedded.start.toISOString(), '2026-08-23T13:00:00.000Z', 'embedded daylight offset');

const iana = ics([
  'BEGIN:VEVENT', 'UID:iana', 'SUMMARY:IANA', 'DTSTART;TZID=America/New_York:20260823T090000',
  'DTEND;TZID=America/New_York:20260823T100000', 'END:VEVENT',
].join('\r\n'));
events = sandbox.parseCalendarIcal(iana, 0, { nowMs: fixedNow, backMs: 86400000, aheadMs: 4 * 86400000 });
const ianaEvent = events.find((e) => e.uid === 'iana');
assert(ianaEvent, 'IANA event');
assert.strictEqual(ianaEvent.start.toISOString(), '2026-08-23T13:00:00.000Z', 'IANA wall time conversion');

console.log('EXACT CALENDAR SYNC ICAL FIXTURES PASS');
