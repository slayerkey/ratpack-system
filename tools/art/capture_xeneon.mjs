import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const slug = process.argv[2];
const outDir = process.argv[3];
if (!slug || !outDir) throw new Error('usage: node tools/art/capture_xeneon.mjs <slug> <out-dir>');
await fs.mkdir(outDir, { recursive: true });
const entry = path.resolve(`widgets/${slug}/index.html`);
const slots = {
  S_H: [840,344], S_V:[696,416], M_H:[840,696], M_V:[696,840],
  L_H:[1688,696], L_V:[696,1688], XL_H:[2536,696], XL_V:[696,2536],
};
const browser = await chromium.launch({ headless: true });

async function openPage(width, height, palette='artist') {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await page.addInitScript(({ palette }) => {
    globalThis.uniqueId = 'rat-art';
    globalThis.palettePreset = 'artist';
    globalThis.gradientMotion = 0;
    globalThis.use24Hour = true;
    globalThis.showHistory = true;
    globalThis.textColor = '#F4F6F8';
    globalThis.accentColor = '#2BE86A';
    globalThis.backgroundColor = '#07090D';
    globalThis.tr = async (value) => value;
    const listeners = [];
    const signal = {
      connect(fn) { listeners.push(fn); },
      emit(id, value) { for (const fn of listeners) fn(id, value); }
    };
    const media = {
      asyncResponse: signal,
      getSongName(id) { setTimeout(() => signal.emit(id, 'Midnight Circuit'), 0); },
      getArtist(id) { setTimeout(() => signal.emit(id, 'Velvet Static'), 0); },
      triggerPreviousTrack() {}, triggerPlayPause() {}, triggerNextTrack() {}
    };
    globalThis.plugins = { Mediadataprovider: media };
    globalThis.__ratArtPalette = palette;
  }, { palette });
  await page.goto(pathToFileURL(entry).href, { waitUntil: 'load' });
  await page.waitForTimeout(1300);
  if (palette !== 'artist') {
    await page.evaluate((palette) => {
      localStorage.setItem('rat-art:now-playing:palette-override', JSON.stringify({ base: 'artist', value: palette }));
    }, palette);
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(1300);
  } else {
    await page.evaluate(() => localStorage.removeItem('rat-art:now-playing:palette-override'));
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(1300);
  }
  const state = await page.evaluate(() => ({
    bodyState: document.body.getAttribute('data-state'),
    title: document.getElementById('trackTitle')?.textContent,
    titleRect: document.getElementById('trackTitle')?.getBoundingClientRect().toJSON(),
    viewportRect: document.getElementById('titleViewport')?.getBoundingClientRect().toJSON(),
    overflow: [document.documentElement.scrollWidth - innerWidth, document.documentElement.scrollHeight - innerHeight],
  }));
  if (state.bodyState !== 'playing' || state.title !== 'Midnight Circuit') throw new Error(`fixture failed: ${JSON.stringify(state)}`);
  if (state.overflow.some(v => v > 0)) throw new Error(`overflow detected: ${JSON.stringify(state)}`);
  if (state.titleRect.bottom > state.viewportRect.bottom + 0.5 || state.titleRect.top < state.viewportRect.top - 0.5) {
    throw new Error(`title glyph bounds exceed viewport: ${JSON.stringify(state)}`);
  }
  return page;
}

for (const [name, [w,h]] of Object.entries(slots)) {
  const page = await openPage(w,h,'artist');
  await page.screenshot({ path: path.join(outDir, `${name}.png`) });
  await page.close();
}
for (const p of ['artist','neon','ember','ocean']) {
  const page = await openPage(840,696,p);
  await page.screenshot({ path: path.join(outDir, `PALETTE_${p.toUpperCase()}.png`) });
  await page.close();
}
await browser.close();
console.log(`RAT ART CAPTURE PASS: ${slug}`);
