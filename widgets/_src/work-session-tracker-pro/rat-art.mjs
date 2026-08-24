const FIXED_NOW = Date.UTC(2026, 7, 20, 18, 30, 0);
const min = 60 * 1000;
function focus(id, name, dayOffset, startMin, durationMin, color, projectId) {
  const d = new Date(FIXED_NOW); d.setUTCDate(d.getUTCDate() + dayOffset); d.setUTCHours(0,0,0,0);
  const start = d.getTime() + startMin * min, end = start + durationMin * min;
  return { id, name, projectId, color, kind:'focus', startedAtMs:start, endedAtMs:end, segments:[{startMs:start,endMs:end}], manualAdjustmentMs:0 };
}
const sessions = [
  focus('d1','Website Redesign',0,540,72,'#2BE86A','web'), focus('d2','Email',0,628,36,'#FFB454','email'),
  focus('p1','Website Redesign',-1,610,155,'#2BE86A','web'), focus('p2','Video Edit',-2,720,125,'#A879FF','video'),
  focus('p3','Website Redesign',-3,570,190,'#2BE86A','web'), focus('p4','Writing',-4,590,95,'#62A8FF','writing'),
  focus('p5','Video Edit',-5,680,145,'#A879FF','video'), focus('p6','Writing',-6,620,110,'#62A8FF','writing')
];
export const variants = [{ name:'week', slot:'L_H', mode:'week' }, { name:'projects', slot:'L_V', mode:'projects' }];
export async function prepare(page) {
  await page.addInitScript(({ now, fixture }) => {
    Date.now = () => now;
    globalThis.uniqueId = 'rat-art-work-session-pro'; globalThis.dailyGoalMinutes = 240;
    globalThis.textColor='#F4F6F8'; globalThis.accentColor='#2BE86A'; globalThis.backgroundColor='#07090D'; globalThis.tr=async v=>v;
    try { localStorage.clear(); } catch {}
    globalThis.__workSessionFixture = fixture;
  }, { now:FIXED_NOW, fixture:{ sequence:30, lastProjectName:'Website Redesign', sessions, projects:[{id:'web',name:'Website Redesign',color:'#2BE86A'},{id:'writing',name:'Writing',color:'#62A8FF'},{id:'video',name:'Video Edit',color:'#A879FF'},{id:'email',name:'Email',color:'#FFB454'}], active:{id:'active',name:'Website Redesign',projectId:'web',color:'#2BE86A',kind:'focus',startedAtMs:FIXED_NOW-88*min,status:'running',segments:[{startMs:FIXED_NOW-88*min,endMs:null}]}} });
}
export async function ready(page, context) {
  await page.waitForFunction(() => globalThis.__workSessionReady === true, { timeout:5000 });
  if (context.variant?.mode) {
    const target = context.variant.mode;
    const tab = page.locator(`[data-view="${target}"]`);
    if (await tab.count()) await tab.click();
  }
  await page.waitForTimeout(80);
}
export async function assert(page, context) {
  const expected=context.slot.toLowerCase().replace('_','-');
  const report=await page.evaluate(()=>({slot:document.body.dataset.slot,edition:document.body.dataset.edition,total:document.getElementById('todayTotal')?.textContent?.trim(),chips:document.querySelectorAll('.project-chip').length,timeline:document.querySelectorAll('.timeline-block').length}));
  if(report.slot!==expected||report.edition!=='pro'||report.total==='0m'||report.chips<3||report.timeline<2) throw new Error(`Pro fixture mismatch ${JSON.stringify(report)}`);
}
