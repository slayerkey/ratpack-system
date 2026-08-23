export const variants = [
  { name: 'artist', slot: 'M_H', palette: 'artist' },
  { name: 'neon', slot: 'M_H', palette: 'neon' },
  { name: 'ember', slot: 'M_H', palette: 'ember' },
  { name: 'ocean', slot: 'M_H', palette: 'ocean' },
];

function paletteFor(context) {
  return context.variant?.palette || 'artist';
}

export async function prepare(page, context) {
  const palette = paletteFor(context);
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

export async function ready(page, context) {
  const palette = paletteFor(context);
  await page.waitForTimeout(250);
  await page.evaluate((value) => {
    localStorage.clear();
    if (value !== 'artist') {
      localStorage.setItem('rat-art:now-playing:palette-override', JSON.stringify({ base: 'artist', value }));
    }
  }, palette);
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => (
    document.body.getAttribute('data-state') === 'playing'
    && document.getElementById('trackTitle')?.textContent === 'Midnight Circuit'
  ), { timeout: 10000 });
  await page.waitForTimeout(450);
}

export async function assert(page) {
  const state = await page.evaluate(() => ({
    bodyState: document.body.getAttribute('data-state'),
    title: document.getElementById('trackTitle')?.textContent,
    titleRect: document.getElementById('trackTitle')?.getBoundingClientRect().toJSON(),
    viewportRect: document.getElementById('titleViewport')?.getBoundingClientRect().toJSON(),
  }));
  if (state.bodyState !== 'playing' || state.title !== 'Midnight Circuit') {
    throw new Error(`Now Playing fixture failed: ${JSON.stringify(state)}`);
  }
  if (!state.titleRect || !state.viewportRect) {
    throw new Error(`Now Playing title geometry missing: ${JSON.stringify(state)}`);
  }
  if (
    state.titleRect.bottom > state.viewportRect.bottom + 0.5
    || state.titleRect.top < state.viewportRect.top - 0.5
  ) {
    throw new Error(`Now Playing title glyph bounds exceed viewport: ${JSON.stringify(state)}`);
  }
}
