const FIXED_NOW = Date.UTC(2026, 7, 20, 18, 30, 0);
const min = 60 * 1000;
function session(id, name, startMin, endMin, color = '#2BE86A') {
  return { id, name, color, kind: 'focus', startedAtMs: FIXED_NOW + startMin * min, endedAtMs: FIXED_NOW + endMin * min, segments: [{ startMs: FIXED_NOW + startMin * min, endMs: FIXED_NOW + endMin * min }], manualAdjustmentMs: 0 };
}
export const variants = [{ name: 'paused', slot: 'M_H', mode: 'paused' }];
export async function prepare(page, context) {
  await page.addInitScript(({ now, fixture }) => {
    Date.now = () => now;
    globalThis.uniqueId = 'rat-art-work-session-lite';
    globalThis.textColor = '#F4F6F8'; globalThis.accentColor = '#2BE86A'; globalThis.backgroundColor = '#07090D';
    globalThis.tr = async value => value;
    globalThis.pluginLinkprovider_initialized = true;
    globalThis.plugins = { Linkprovider: { open(link) { globalThis.__openedLink = link; } } };
    try { localStorage.clear(); } catch {}
    globalThis.__workSessionFixture = fixture;
  }, { now: FIXED_NOW, fixture: {
    lastProjectName: 'Website Redesign', sequence: 9,
    sessions: [session('a','Writing',-570,-498,'#62A8FF'), session('b','Email',-482,-446,'#FFB454')],
    active: { id:'active-c', name:'Website Redesign', color:'#2BE86A', kind:'focus', startedAtMs:FIXED_NOW-430*min, status:'running', segments:[{startMs:FIXED_NOW-430*min,endMs:FIXED_NOW-405*min},{startMs:FIXED_NOW-390*min,endMs:null}] }
  }});
}
export async function ready(page, context) {
  await page.waitForFunction(() => globalThis.__workSessionReady === true, { timeout: 5000 });
  if (context.variant?.mode === 'paused') {
    await page.evaluate(() => { globalThis.__workSessionTest.pause(); });
    await page.waitForFunction(() => document.body.dataset.sessionState === 'paused');
  }
  await page.waitForTimeout(80);
}
export async function assert(page, context) {
  const expected = context.slot.toLowerCase().replace('_','-');
  const report = await page.evaluate(() => ({ slot:document.body.dataset.slot, edition:document.body.dataset.edition, state:document.body.dataset.sessionState, name:document.getElementById('currentName')?.textContent?.trim(), total:document.getElementById('todayTotal')?.textContent?.trim(), timeline:document.querySelectorAll('.timeline-block').length }));
  if (report.slot !== expected || report.edition !== 'lite') throw new Error(`Lite fixture mismatch ${JSON.stringify(report)}`);
  if (report.name !== 'Website Redesign' || report.total === '0m' || report.timeline < 3) throw new Error(`Lite fixture content mismatch ${JSON.stringify(report)}`);
}
