import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const entry = path.join(root, 'widgets', 'agenda-panel', 'index.html');
const entryHtml = fs.readFileSync(entry, 'utf8');
const outDir = process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, 'artifacts', 'agenda-panel-qa');
if (!fs.existsSync(entry)) throw new Error('Run python tools/xeneon/inline.py agenda-panel first');
fs.mkdirSync(outDir, { recursive: true });

const slots = {
  S_H: [840, 344], S_V: [696, 416], M_H: [840, 696], M_V: [696, 840],
  L_H: [1688, 696], L_V: [696, 1688], XL_H: [2536, 696], XL_V: [696, 2536],
};
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
const dt = (d, h, m = 0) => `${ymd(d)}T${pad(h)}${pad(m)}00`;
const today = new Date(); today.setHours(0, 0, 0, 0);
const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
const fixture = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//PackRat//Agenda QA//EN\r\nBEGIN:VEVENT\r\nUID:all-day\r\nDTSTART;VALUE=DATE:${ymd(today)}\r\nDTEND;VALUE=DATE:${ymd(tomorrow)}\r\nSUMMARY:Product planning day\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nUID:descenders\r\nDTSTART:${dt(today, 20, 30)}\r\nDTEND:${dt(today, 21, 30)}\r\nSUMMARY:Planning sync by Gary\r\nLOCATION:Design Wing\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nUID:daily\r\nDTSTART:${dt(yesterday, 11)}\r\nDTEND:${dt(yesterday, 11, 30)}\r\nRRULE:FREQ=DAILY;COUNT=4\r\nEXDATE:${dt(today, 11)}\r\nSUMMARY:Daily standup\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nUID:daily\r\nRECURRENCE-ID:${dt(tomorrow, 11)}\r\nDTSTART:${dt(tomorrow, 12)}\r\nDTEND:${dt(tomorrow, 12, 30)}\r\nSUMMARY:Moved daily standup\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`;

const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined });
const results = {};
let failed = false;
try {
  for (const [name, [width, height]] of Object.entries(slots)) {
    const page = await browser.newPage({ viewport: { width, height } });
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (error) => errors.push(String(error)));
    await page.goto('about:blank');
    await page.evaluate(({ fixture, entryHtml }) => {
      globalThis.uniqueId = 'agenda-panel-qa';
      globalThis.calendarUrl1 = 'https://fixture.invalid/calendar.ics';
      globalThis.calendarUrl2 = '';
      globalThis.calendarUrl3 = '';
      globalThis.refreshMinutes = 15;
      globalThis.use24Hour = false;
      globalThis.textColor = '#F4F6F8';
      globalThis.accentColor = '#2BE86A';
      globalThis.backgroundColor = '#07090D';
      globalThis.tr = async (value) => value;
      globalThis.__ratpackAgendaFixtures = [fixture];
      document.open();
      document.write(entryHtml);
      document.close();
    }, { fixture, entryHtml });
    await page.waitForTimeout(800);
    const state = await page.evaluate(() => {
      const visible = (e) => {
        const r = e.getBoundingClientRect(); const s = getComputedStyle(e);
        return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0;
      };
      const interactive = [...document.querySelectorAll('.interactive')].filter(visible).map((e) => {
        const r = e.getBoundingClientRect(); return { id: e.id || e.className, w: r.width, h: r.height, left: r.left, right: r.right, top: r.top, bottom: r.bottom };
      });
      const hero = document.getElementById('heroTitle').getBoundingClientRect();
      const card = document.getElementById('heroCard').getBoundingClientRect();
      return {
        state: document.body.dataset.state,
        slot: document.body.dataset.slot,
        scroll: [document.documentElement.scrollWidth - innerWidth, document.documentElement.scrollHeight - innerHeight],
        eventBlocks: [...document.querySelectorAll('.eventBlock')].filter(visible).length,
        compact: [...document.querySelectorAll('.compactEvent')].filter(visible).length,
        badTargets: interactive.filter((x) => x.w < 43.5 || x.h < 43.5),
        offscreen: interactive.filter((x) => x.left < -0.5 || x.top < -0.5 || x.right > innerWidth + 0.5 || x.bottom > innerHeight + 0.5),
        heroContained: hero.top >= card.top - 0.5 && hero.bottom <= card.bottom + 0.5 && hero.left >= card.left - 0.5 && hero.right <= card.right + 0.5,
      };
    });
    await page.screenshot({ path: path.join(outDir, `${name}.png`) });
    state.consoleErrors = errors;
    results[name] = state;
    const expected = name.toLowerCase().replace('_', '-');
    const issues = [];
    if (!['fresh', 'stale'].includes(state.state)) issues.push(`state ${state.state}`);
    if (state.slot !== expected) issues.push(`slot ${state.slot}`);
    if (state.scroll.some((v) => v > 0)) issues.push(`overflow ${state.scroll.join(',')}`);
    if (state.badTargets.length) issues.push('small touch target');
    if (state.offscreen.length) issues.push('offscreen interaction');
    if (!state.heroContained) issues.push('hero text clipped');
    if (errors.length) issues.push(`console errors ${errors.length}`);
    if (name.endsWith('_H') && name !== 'S_H' && !state.eventBlocks) issues.push('missing timeline events');
    if ((name.endsWith('_V') || name === 'S_H') && !state.compact) issues.push('missing compact events');

    if (name === 'M_H') {
      const behavior = await page.evaluate(async () => {
        const initialMode = document.body.dataset.mode;
        document.getElementById('heroCard').click();
        const toggledMode = document.body.dataset.mode;
        document.getElementById('heroCard').click();
        const restoredMode = document.body.dataset.mode;

        const eventButton = document.querySelector('.eventBlock');
        if (eventButton) eventButton.click();
        const detailOpened = document.getElementById('detailOverlay').classList.contains('open');
        document.getElementById('detailClose').click();
        const detailClosed = !document.getElementById('detailOverlay').classList.contains('open');

        const lifecycleReady = Boolean(
          globalThis.icueEvents &&
          typeof globalThis.icueEvents.onICUEInitialized === 'function' &&
          typeof globalThis.icueEvents.onDataUpdated === 'function'
        );
        let loadCalls = 0;
        const originalLoad = globalThis.loadCalendarText;
        globalThis.loadCalendarText = function () {
          loadCalls++;
          return originalLoad.apply(this, arguments);
        };
        globalThis.accentColor = '#FF00AA';
        globalThis.icueEvents.onDataUpdated();
        const callsAfterAppearance = loadCalls;
        const accentAfterAppearance = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
        globalThis.calendarUrl1 = 'https://fixture.invalid/changed.ics';
        globalThis.icueEvents.onDataUpdated();
        await new Promise((resolve) => setTimeout(resolve, 40));
        return {
          initialMode, toggledMode, restoredMode, detailOpened, detailClosed, lifecycleReady,
          callsAfterAppearance, callsAfterUrl: loadCalls, accentAfterAppearance
        };
      });
      state.behavior = behavior;
      if (behavior.initialMode !== 'today' || behavior.toggledMode !== 'four' || behavior.restoredMode !== 'today') issues.push('hero range toggle failed');
      if (!behavior.detailOpened || !behavior.detailClosed) issues.push('event detail interaction failed');
      if (!behavior.lifecycleReady) issues.push('iCUE lifecycle callbacks missing');
      if (behavior.callsAfterAppearance !== 0) issues.push('appearance update refetched calendar');
      if (behavior.callsAfterUrl < 1) issues.push('calendar URL update did not refresh');
      if (behavior.accentAfterAppearance.toLowerCase() !== '#ff00aa') issues.push('appearance update did not render');
    }

    if (issues.length) { failed = true; state.issues = issues; }
    await page.close();
  }
} finally {
  await browser.close();
}
fs.writeFileSync(path.join(outDir, 'result.json'), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
if (failed) process.exit(1);
console.log('AGENDA PANEL EIGHT SLOT QA PASS');
