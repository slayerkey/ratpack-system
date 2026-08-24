export const variants = [
  { name: 'completed', slot: 'M_H', mode: 'completed' },
  { name: 'long-copy', slot: 'S_H', mode: 'long' }
];
export async function prepare(page, context) {
  await page.addInitScript(({mode}) => {
    globalThis.uniqueId = 'rat-art-desk-notes';
    globalThis.boardTitle = mode === 'long' ? 'CURRENT PROJECT WITH A LONG TITLE' : 'TODAY';
    globalThis.boardContent = mode === 'long'
      ? '[ ] Finish a deliberately long thumbnail revision that must ellipsize safely\n[ ] Upload final video and verify the scheduled publish settings\nRespond to an email with a long subject line\nCall dentist\nBuy SSD\n[ ] Review marketplace copy\nTest every layout\nSubmit assets'
      : '[ ] Finish thumbnail\n[ ] Upload video\nRespond to email\n[ ] Send sponsor follow up\nCall dentist\nBuy SSD\n[ ] Test layouts\nSubmit Marketplace assets';
    globalThis.noteTheme = 'midnight'; globalThis.fontScale = 100; globalThis.textColor = '#F4F7FB'; globalThis.accentColor = '#65E69C'; globalThis.backgroundColor = '#07090D'; globalThis.transparency = 0;
    globalThis.tr = async value => value;
    globalThis.iCUE = { isPreview: true };
    globalThis.plugins = { Linkprovider: { open() {} } };
    try { localStorage.clear(); } catch {}
  }, {mode: context.variant?.mode || ''});
}
export async function ready(page, context) {
  await page.waitForFunction(() => document.querySelectorAll('.note-item').length > 0, {timeout: 5000});
  if (context.variant?.mode === 'completed') {
    await page.locator('.note-item.is-check').first().click();
    await page.waitForFunction(() => document.querySelector('.note-item.is-done'));
  }
  await page.waitForTimeout(100);
}
export async function assert(page, context) {
  const report = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('.note-item'));
    return {
      count: rows.length,
      done: document.querySelectorAll('.note-item.is-done').length,
      bodyOverflowX: document.documentElement.scrollWidth - innerWidth,
      bodyOverflowY: document.documentElement.scrollHeight - innerHeight,
      minRow: Math.min(...rows.map(r => r.getBoundingClientRect().height))
    };
  });
  if (report.count !== 8) throw new Error(`Expected 8 visible entries: ${JSON.stringify(report)}`);
  if (report.bodyOverflowX > .5 || report.bodyOverflowY > .5) throw new Error(`Overflow: ${JSON.stringify(report)}`);
  if (context.variant?.mode === 'completed' && report.done !== 1) throw new Error(`Completion touch failed: ${JSON.stringify(report)}`);
  if (report.minRow < 25) throw new Error(`Touch rows collapsed: ${JSON.stringify(report)}`);
}
