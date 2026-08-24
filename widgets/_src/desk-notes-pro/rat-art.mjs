export const variants = [
  { name: 'history', slot: 'M_H', mode: 'history' },
  { name: 'max-notes', slot: 'S_H', mode: 'max' },
  { name: 'second-board', slot: 'L_H', mode: 'second' },
  { name: 'settings', slot: 'XL_H', mode: 'settings' },
];

export async function prepare(page, context) {
  await page.addInitScript(({ mode }) => {
    globalThis.uniqueId = 'rat-art-desk-notes-pro';
    const boards = [
      ['## Content','# Creator','! [ ] Finish thumbnail','[ ] Upload video','Respond to email','','## Remember','Call dentist','Buy SSD'],
      ['## Launch','! [ ] Ship widget','[ ] Test layouts','[ ] Submit assets','','## Later','Write changelog'],
      ['[ ] Grocery run','Book appointment','Text Alex'],
      ['# Release','[ ] Final QA','[ ] Rat Art','[ ] Ship kit']
    ];
    if (mode === 'max') boards[0] = Array.from({length:16}, (_, i) => (i === 0 ? '! ' : '') + '[ ] Task ' + (i + 1));
    const titles = ['TODAY','WORK','PERSONAL','CURRENT PROJECT'];
    for (let b = 1; b <= 4; b++) {
      globalThis[`board${b}Title`] = titles[b - 1];
      for (let i = 1; i <= 16; i++) globalThis[`board${b}Entry${i}`] = boards[b - 1][i - 1] || '';
    }
    globalThis.arrangement = 'cards';
    globalThis.rotateBoards = false;
    globalThis.rotationSeconds = 30;
    globalThis.showHistory = true;
    globalThis.noteTheme = 'ocean';
    globalThis.fontScale = 100;
    globalThis.textColor = '#F4F7FB';
    globalThis.accentColor = '#74C6FF';
    globalThis.backgroundColor = '#07090D';
    globalThis.transparency = 0;
    globalThis.tr = async v => v;
    globalThis.iCUE = { isPreview: true };
    try { localStorage.clear(); } catch {}
  }, { mode: context.variant?.mode || '' });
}

export async function ready(page, context) {
  const mode = context.variant?.mode || '';
  await page.waitForFunction(() => document.querySelectorAll('.note-item').length > 0, { timeout: 5000 });
  if (mode === 'second') {
    await page.locator('.board-tab').nth(1).click();
    await page.waitForFunction(() => document.getElementById('boardTitleView')?.textContent === 'WORK');
  }
  if (mode === 'history') {
    await page.locator('.note-item.is-check').first().click();
    await page.locator('#historyButton').click();
    await page.waitForFunction(() => document.getElementById('historyOverlay')?.classList.contains('is-open'));
  }
  if (mode === 'settings') {
    await page.evaluate(() => {
      globalThis.arrangement = 'columns';
      globalThis.noteTheme = 'rose';
      globalThis.fontScale = 110;
      globalThis.icueEvents.onDataUpdated();
    });
    await page.waitForFunction(() => document.body.getAttribute('data-arrangement') === 'columns' && document.body.getAttribute('data-theme') === 'rose');
  }
  await page.waitForTimeout(100);
}

export async function assert(page, context) {
  const mode = context.variant?.mode || '';
  const r = await page.evaluate(() => ({
    title: document.getElementById('boardTitleView')?.textContent,
    count: document.querySelectorAll('.note-item').length,
    tabs: document.querySelectorAll('.board-tab').length,
    history: document.querySelectorAll('.history-row').length,
    more: document.getElementById('moreCount')?.textContent || '',
    arrangement: document.body.getAttribute('data-arrangement'),
    theme: document.body.getAttribute('data-theme'),
    ox: document.documentElement.scrollWidth - innerWidth,
    oy: document.documentElement.scrollHeight - innerHeight,
  }));
  if (r.tabs !== 4) throw new Error(`Expected 4 tabs ${JSON.stringify(r)}`);
  if (r.ox > .5 || r.oy > .5) throw new Error(`Overflow ${JSON.stringify(r)}`);
  if (mode === 'second' && r.title !== 'WORK') throw new Error(`Board switch failed ${JSON.stringify(r)}`);
  if (mode === 'history' && r.history < 1) throw new Error(`History failed ${JSON.stringify(r)}`);
  if (mode === 'max' && (!r.more || r.count > 8 || !r.more.includes('+8'))) throw new Error(`Small max-note handling failed ${JSON.stringify(r)}`);
  if (mode === 'settings' && (r.arrangement !== 'columns' || r.theme !== 'rose')) throw new Error(`Settings update failed ${JSON.stringify(r)}`);
}
