export const variants = [
  { name: "matrix", slot: "M_H", theme: "matrix" },
  { name: "ice", slot: "M_H", theme: "ice" },
  { name: "ember", slot: "M_H", theme: "ember" },
  { name: "mono", slot: "M_H", theme: "mono" }
];

export async function prepare(page, context) {
  const theme = context.variant?.theme || "matrix";
  await page.addInitScript(({ theme, slug, slot }) => {
    globalThis.uniqueId = `${slug}-rat-art-${slot}-${theme}`;
    globalThis.themePreset = theme;
    globalThis.showTouchGuides = true;
    globalThis.tr = async value => value;
    try { localStorage.removeItem(globalThis.uniqueId); } catch (_) {}
  }, { theme, slug: context.slug, slot: context.slot });
}

export async function ready(page) {
  await page.waitForFunction(() => Boolean(window.__PACKRAT_SNAKE__));
  await page.evaluate(() => {
    const api = window.__PACKRAT_SNAKE__;
    const { cols, rows } = api.getState().config;
    const cy = Math.floor(rows * .53);
    const minX = Math.max(2, Math.floor(cols * .12));
    const maxX = Math.max(minX + 5, Math.floor(cols * .58));
    const snake = [];
    for (let x = maxX; x >= minX; x--) snake.push({ x, y: cy });
    const food = { x: Math.min(cols - 2, Math.floor(cols * .78)), y: cy };
    api.setFixture({ snake, food, direction: "right", state: "playing", score: 180, highScore: 430 });
    api.draw();
  });
  await page.waitForTimeout(80);
}

export async function assert(page, context) {
  const result = await page.evaluate(() => {
    const api = window.__PACKRAT_SNAKE__;
    const s = api.getState();
    const overlay = document.getElementById("overlay");
    const canvas = document.getElementById("gameCanvas").getBoundingClientRect();
    const zones = Array.from(document.querySelectorAll(".touch-zone")).map(el => el.getBoundingClientRect());
    return {
      slot: s.slot,
      state: s.state,
      score: s.score,
      highScore: s.highScore,
      overlayOpacity: Number(getComputedStyle(overlay).opacity),
      canvas: { width: canvas.width, height: canvas.height },
      zoneCount: zones.filter(r => r.width > 0 && r.height > 0).length
    };
  });
  const expected = context.slot.toLowerCase().replace("_", "-");
  if (result.slot !== expected) throw new Error(`Rat Art slot mismatch ${context.slot}: ${result.slot}`);
  if (result.state !== "playing") throw new Error(`Rat Art fixture must show active game: ${result.state}`);
  if (result.score !== 180 || result.highScore !== 430) throw new Error("Rat Art score fixture drifted");
  if (result.overlayOpacity > .05) throw new Error("Rat Art active-game overlay should be hidden");
  if (result.canvas.width < 100 || result.canvas.height < 100) throw new Error("Rat Art canvas is unexpectedly small");
  if (result.zoneCount !== 4) throw new Error("Rat Art touch zones missing");
}
