const FIXED_NOW_MS = new Date(2026, 7, 23, 10, 20, 0).getTime();

function calendarFixture() {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PackRat//Calendar Panel Rat Art//EN',
    'BEGIN:VEVENT',
    'UID:launch-day',
    'DTSTART;VALUE=DATE:20260823',
    'DTEND;VALUE=DATE:20260824',
    'SUMMARY:Product launch day',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'UID:morning-review',
    'DTSTART:20260823T083000',
    'DTEND:20260823T093000',
    'SUMMARY:Morning review',
    'LOCATION:Studio',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'UID:planning-sync',
    'DTSTART:20260823T104500',
    'DTEND:20260823T114500',
    'SUMMARY:Planning sync by Gary',
    'LOCATION:Design Wing',
    'DESCRIPTION:Finalize the release plan and owner checklist.',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'UID:creative-block',
    'DTSTART:20260823T130000',
    'DTEND:20260823T153000',
    'SUMMARY:Creative focus block',
    'LOCATION:Office',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'UID:partner-call',
    'DTSTART:20260823T133000',
    'DTEND:20260823T143000',
    'SUMMARY:Partner call',
    'LOCATION:Meet',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'UID:qa-pass',
    'DTSTART:20260823T140000',
    'DTEND:20260823T150000',
    'SUMMARY:QA pass',
    'LOCATION:Lab',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'UID:daily-checkin',
    'DTSTART:20260823T163000',
    'DTEND:20260823T170000',
    'RRULE:FREQ=DAILY;COUNT=3',
    'SUMMARY:Daily check-in',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'UID:tomorrow-brief',
    'DTSTART:20260824T090000',
    'DTEND:20260824T100000',
    'SUMMARY:Tomorrow brief',
    'LOCATION:Studio',
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}

export async function prepare(page) {
  await page.addInitScript(({ fixedNow, fixture }) => {
    const NativeDate = Date;
    class FixedDate extends NativeDate {
      constructor(...args) {
        super(...(args.length ? args : [fixedNow]));
      }
      static now() { return fixedNow; }
      static parse(value) { return NativeDate.parse(value); }
      static UTC(...args) { return NativeDate.UTC(...args); }
    }
    globalThis.Date = FixedDate;
    globalThis.uniqueId = 'rat-art-agenda-panel';
    globalThis.calendarUrl1 = 'https://fixture.packrat.invalid/calendar.ics';
    globalThis.calendarUrl2 = '';
    globalThis.calendarUrl3 = '';
    globalThis.refreshMinutes = 15;
    globalThis.use24Hour = false;
    globalThis.textColor = '#F4F6F8';
    globalThis.accentColor = '#2BE86A';
    globalThis.backgroundColor = '#07090D';
    globalThis.tr = async (value) => value;
    globalThis.__ratpackAgendaFixtures = [fixture];
  }, { fixedNow: FIXED_NOW_MS, fixture: calendarFixture() });
}

export async function ready(page) {
  await page.waitForFunction(() => (
    document.body.getAttribute('data-state') === 'fresh'
    && document.getElementById('heroTitle')?.textContent === 'Planning sync by Gary'
    && Array.isArray(globalThis.STATE?.events)
    && globalThis.STATE.events.length >= 7
  ), { timeout: 10000 });
  await page.waitForTimeout(350);
}

export async function assert(page, context) {
  const state = await page.evaluate(() => {
    const hero = document.getElementById('heroTitle')?.getBoundingClientRect();
    const card = document.getElementById('heroCard')?.getBoundingClientRect();
    return {
      bodyState: document.body.getAttribute('data-state'),
      slot: document.body.getAttribute('data-slot'),
      heroTitle: document.getElementById('heroTitle')?.textContent,
      eventCount: globalThis.STATE?.events?.length || 0,
      exactIcal: !!globalThis.ICAL && typeof globalThis.parseCalendarIcal === 'function',
      heroContained: !!hero && !!card && hero.top >= card.top - 0.5 && hero.bottom <= card.bottom + 0.5,
    };
  });
  if (state.bodyState !== 'fresh' || state.heroTitle !== 'Planning sync by Gary') {
    throw new Error(`Calendar Panel Rat Art fixture failed: ${JSON.stringify(state)}`);
  }
  if (!state.exactIcal || state.eventCount < 7) {
    throw new Error(`Calendar Panel exact parser fixture failed: ${JSON.stringify(state)}`);
  }
  if (!state.heroContained) {
    throw new Error(`Calendar Panel hero glyph bounds exceed card: ${JSON.stringify(state)}`);
  }
  const expected = String(context.slot || '').toLowerCase().replace('_', '-');
  if (state.slot !== expected) {
    throw new Error(`Calendar Panel slot mismatch: expected ${expected}, got ${state.slot}`);
  }
}
