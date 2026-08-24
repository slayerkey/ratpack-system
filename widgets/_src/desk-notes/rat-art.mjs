export const variants = [
  { name: 'completed', slot: 'M_H', mode: 'completed' },
  { name: 'long-copy', slot: 'S_H', mode: 'long' },
  { name: 'empty', slot: 'M_V', mode: 'empty' },
  { name: 'persistence', slot: 'M_H', mode: 'persistence' },
  { name: 'settings', slot: 'L_H', mode: 'settings' },
];

export async function prepare(page, context) {
  await page.addInitScript(({ mode }) => {
    globalThis.uniqueId = 'rat-art-desk-notes';
    const standard = ['[ ] Finish thumbnail','[ ] Upload video','Respond to email','[ ] Send sponsor follow up','Call dentist','Buy SSD','[ ] Test layouts','Submit Marketplace assets'];
    const long = ['[ ] Finish a deliberately long thumbnail revision that must ellipsize safely','[ ] Upload final video and verify the scheduled publish settings','Respond to an email with a deliberately long subject line','Call dentist','Buy a replacement SSD before the current drive fills up','[ ] Review marketplace copy for every listing field','Test every layout at every official XENEON size','Submit all Marketplace assets after final QA'];
    const values = mode === 'empty' ? Array(8).fill('') : mode === 'long' ? long : standard;
    globalThis.boardTitle = mode === 'long' ? 'CURRENT PROJECT WITH A LONG TITLE THAT MUST CLIP SAFELY' : mode === 'empty' ? 'EMPTY BOARD' : 'TODAY';
    for (let i = 1; i <= 8; i++) globalThis[`entry${i}`] = values[i - 1] || '';
    globalThis.noteTheme = 'midnight';
    globalThis.fontScale = 100;
    globalThis.textColor = '#F4F7FB';
    globalThis.accentColor = '#65E69C';
    globalThis.backgroundColor = '#07090D';
    globalThis.transparency = 0;
    globalThis.tr = async value => value;
    globalThis.iCUE = { isPreview: true };
    globalThis.plugins = { Linkprovider: { open() {} } };
    try {
      if (!sessionStorage.getItem('desk-notes-fixture-seeded')) {
        localStorage.clear();
        sessionStorage.setItem('desk-notes-fixture-seeded', '1');
      }
    } catch {}
  }, { mode: context.variant?.mode || '' });
}

export async function ready(page, context) {
  const mode = context.variant?.mode || '';
  await page.waitForFunction(() => document.querySelector('.note-card'), { timeout: 5000 });
  if (mode === 'completed') {
    await page.locator('.note-item.is-check').first().click();
    await page.waitForFunction(() => document.querySelectorAll('.note-item.is-done').length === 1);
  }
  if (mode === 'persistence') {
    await page.locator('.note-item.is-check').first().click();
    await page.waitForFunction(() => document.querySelectorAll('.note-item.is-done').length === 1);
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => document.querySelectorAll('.note-item.is-done').length === 1, { timeout: 5000 });
  }
  if (mode === 'settings') {
    await page.evaluate(() => {
      globalThis.noteTheme = 'paper';
      globalThis.fontScale = 125;
      globalThis.accentColor = '#D56C45';
      globalThis.icueEvents.onDataUpdated();
    });
    await page.waitForFunction(() => document.body.getAttribute('data-theme') === 'paper' && getComputedStyle(document.documentElement).getPropertyValue('--font-scale').trim() === '1.25');
  }
  if (mode === 'empty') {
    await page.waitForFunction(() => document.querySelector('.empty-card'));
  }
  await page.waitForTimeout(100);
}

export async function assert(page, context) {
  const mode = context.variant?.mode || '';
  const report = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('.note-item'));
    return {
      count: rows.length,
      done: document.querySelectorAll('.note-item.is-done').length,
      empty: Boolean(document.querySelector('.empty-card')),
      bodyOverflowX: document.documentElement.scrollWidth - innerWidth,
      bodyOverflowY: document.documentElement.scrollHeight - innerHeight,
      minRow: rows.length ? Math.min(...rows.map(r => r.getBoundingClientRect().height)) : null,
      theme: document.body.getAttribute('data-theme'),
      fontScale: getComputedStyle(document.documentElement).getPropertyValue('--font-scale').trim(),
      titleWidth: document.getElementById('boardTitleView').getBoundingClientRect().width,
      titleScrollWidth: document.getElementById('boardTitleView').scrollWidth,
    };
  });
  if (report.bodyOverflowX > .5 || report.bodyOverflowY > .5) throw new Error(`Overflow: ${JSON.stringify(report)}`);
  if (mode === 'empty') {
    if (report.count !== 0 || !report.empty) throw new Error(`Empty board state failed: ${JSON.stringify(report)}`);
    return;
  }
  if (report.count !== 8) throw new Error(`Expected 8 visible entries: ${JSON.stringify(report)}`);
  if (report.minRow < 25) throw new Error(`Touch rows collapsed: ${JSON.stringify(report)}`);
  if ((mode === 'completed' || mode === 'persistence') && report.done !== 1) throw new Error(`Completion persistence failed: ${JSON.stringify(report)}`);
  if (mode === 'settings' && (report.theme !== 'paper' || report.fontScale !== '1.25')) throw new Error(`Settings update failed: ${JSON.stringify(report)}`);
  if (mode === 'long' && report.titleScrollWidth <= report.titleWidth) throw new Error(`Long-title clipping fixture did not exercise clipping: ${JSON.stringify(report)}`);
}
