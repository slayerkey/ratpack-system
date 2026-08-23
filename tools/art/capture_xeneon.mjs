import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const slug = process.argv[2];
const outDir = process.argv[3];
if (!slug || !outDir) throw new Error('usage: node tools/art/capture_xeneon.mjs <slug> <out-dir>');

await fs.mkdir(outDir, { recursive: true });
const entry = path.resolve(`widgets/${slug}/index.html`);
const fixture = path.resolve(`widgets/_src/${slug}/rat-art-fixture.js`);
const slots = {
  S_H: [840, 344], S_V: [696, 416], M_H: [840, 696], M_V: [696, 840],
  L_H: [1688, 696], L_V: [696, 1688], XL_H: [2536, 696], XL_V: [696, 2536],
};
const browser = await chromium.launch({ headless: true });

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

const hasProductFixture = await exists(fixture);
if (!hasProductFixture && slug !== 'now-playing') {
  throw new Error(`missing deterministic Rat Art fixture: widgets/_src/${slug}/rat-art-fixture.js`);
}

async function addNowPlayingFixture(page, palette) {
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
      emit(id, value) { for (const fn of listeners) fn(id, value); },
    };
    const media = {
      asyncResponse: signal,
      getSongName(id) { setTimeout(() => signal.emit(id, 'Midnight Circuit'), 0); },
      getArtist(id) { setTimeout(() => signal.emit(id, 'Velvet Static'), 0); },
      triggerPreviousTrack() {},
      triggerPlayPause() {},
      triggerNextTrack() {},
    };
    globalThis.plugins = { Mediadataprovider: media };
    globalThis.__ratArtPalette = palette;
  }, { palette });
}

async function openPage(width, height, palette = 'artist') {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  const consoleErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text().slice(0, 240));
  });
  page.on('pageerror', (error) => consoleErrors.push(String(error).slice(0, 240)));

  if (hasProductFixture) await page.addInitScript({ path: fixture });
  else await addNowPlayingFixture(page, palette);

  await page.goto(pathToFileURL(entry).href, { waitUntil: 'load' });
  await page.waitForTimeout(1500);

  if (slug === 'now-playing') {
    if (palette !== 'artist') {
      await page.evaluate((nextPalette) => {
        localStorage.setItem('rat-art:now-playing:palette-override', JSON.stringify({ base: 'artist', value: nextPalette }));
      }, palette);
      await page.reload({ waitUntil: 'load' });
      await page.waitForTimeout(1300);
    } else {
      await page.evaluate(() => localStorage.removeItem('rat-art:now-playing:palette-override'));
      await page.reload({ waitUntil: 'load' });
      await page.waitForTimeout(1300);
    }
  }

  const state = await page.evaluate(() => ({
    bodyState: document.body.getAttribute('data-state'),
    connection: document.body.getAttribute('data-connection'),
    overflow: [
      document.documentElement.scrollWidth - innerWidth,
      document.documentElement.scrollHeight - innerHeight,
    ],
    touchTargets: Array.from(document.querySelectorAll('.interactive:not([disabled])')).map((element) => {
      const rect = element.getBoundingClientRect();
      return { width: rect.width, height: rect.height, visible: rect.width > 0 && rect.height > 0 };
    }),
    nowPlaying: {
      title: document.getElementById('trackTitle')?.textContent || '',
      titleRect: document.getElementById('trackTitle')?.getBoundingClientRect().toJSON?.() || null,
      viewportRect: document.getElementById('titleViewport')?.getBoundingClientRect().toJSON?.() || null,
    },
  }));

  if (consoleErrors.length) throw new Error(`console errors: ${JSON.stringify(consoleErrors)}`);
  if (state.overflow.some((value) => value > 0)) throw new Error(`overflow detected: ${JSON.stringify(state)}`);

  const undersized = state.touchTargets.filter((target) => target.visible && (target.width < 56 || target.height < 56));
  if (undersized.length) throw new Error(`touch target below 56px: ${JSON.stringify(undersized)}`);

  if (slug === 'now-playing') {
    if (state.bodyState !== 'playing' || state.nowPlaying.title !== 'Midnight Circuit') {
      throw new Error(`Now Playing fixture failed: ${JSON.stringify(state)}`);
    }
    const titleRect = state.nowPlaying.titleRect;
    const viewportRect = state.nowPlaying.viewportRect;
    if (titleRect && viewportRect && (titleRect.bottom > viewportRect.bottom + 0.5 || titleRect.top < viewportRect.top - 0.5)) {
      throw new Error(`title glyph bounds exceed viewport: ${JSON.stringify(state)}`);
    }
  } else if (state.connection && state.connection !== 'connected') {
    throw new Error(`product fixture did not reach connected state: ${JSON.stringify(state)}`);
  }

  return page;
}

for (const [name, [width, height]] of Object.entries(slots)) {
  const page = await openPage(width, height, 'artist');
  await page.screenshot({ path: path.join(outDir, `${name}.png`) });
  await page.close();
}

if (slug === 'now-playing') {
  for (const palette of ['artist', 'neon', 'ember', 'ocean']) {
    const page = await openPage(840, 696, palette);
    await page.screenshot({ path: path.join(outDir, `PALETTE_${palette.toUpperCase()}.png`) });
    await page.close();
  }
}

await browser.close();
console.log(`RAT ART CAPTURE PASS: ${slug}`);
