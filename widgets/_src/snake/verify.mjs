import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const repo = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(".");
const entry = path.join(repo, "widgets", "snake", "index.html");
if (!fs.existsSync(entry)) throw new Error(`shipping widget not found: ${entry}`);

const slots = [
  ["s-h", 840, 344], ["s-v", 696, 416], ["m-h", 840, 696], ["m-v", 696, 840],
  ["l-h", 1688, 696], ["l-v", 696, 1688], ["xl-h", 2536, 696], ["xl-v", 696, 2536]
];
const browser = await chromium.launch({ headless: true });
const failures = [];
const perf = [];
const fail = (slot, message) => failures.push(`${slot}: ${message}`);

for (const [slot, width, height] of slots) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1, hasTouch: true, isMobile: false });
  const runtimeErrors = [];
  page.on("pageerror", error => runtimeErrors.push(`pageerror ${String(error)}`));
  page.on("console", msg => { if (msg.type() === "error") runtimeErrors.push(`console ${msg.text()}`); });

  await page.addInitScript(({ slot }) => {
    globalThis.uniqueId = `snake-qa-${slot}`;
    globalThis.themePreset = "matrix";
    globalThis.showTouchGuides = true;
    globalThis.tr = async value => value;
    if (!sessionStorage.getItem("snake-qa-storage-initialized")) {
      try { localStorage.removeItem(globalThis.uniqueId); } catch (_) {}
      sessionStorage.setItem("snake-qa-storage-initialized", "1");
    }
  }, { slot });

  await page.goto(pathToFileURL(entry).href, { waitUntil: "load" });
  await page.waitForFunction(() => Boolean(window.__PACKRAT_SNAKE__));
  await page.waitForTimeout(80);

  const report = await page.evaluate(() => {
    const api = window.__PACKRAT_SNAKE__;
    const s = api.getState();
    const rect = document.getElementById("gameCanvas").getBoundingClientRect();
    const visible = el => {
      if (!el) return false;
      const style = getComputedStyle(el);
      const box = el.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && box.width > 0 && box.height > 0;
    };
    return {
      state: s,
      overflowX: document.documentElement.scrollWidth - innerWidth,
      overflowY: document.documentElement.scrollHeight - innerHeight,
      canvasWidth: rect.width,
      canvasHeight: rect.height,
      restartVisible: visible(document.getElementById("restartButton")),
      pauseVisible: visible(document.getElementById("pauseButton")),
      touchVisible: Array.from(document.querySelectorAll(".touch-zone")).filter(visible).length
    };
  });

  if (report.state.slot !== slot) fail(slot, `selected slot ${report.state.slot}`);
  if (report.overflowX > 0.5 || report.overflowY > 0.5) fail(slot, `overflow ${report.overflowX}x${report.overflowY}`);
  if (report.canvasWidth < 100 || report.canvasHeight < 100) fail(slot, `canvas too small ${report.canvasWidth}x${report.canvasHeight}`);
  if (!report.restartVisible || !report.pauseVisible) fail(slot, "pause/restart controls must remain available");
  if (report.touchVisible !== 4) fail(slot, `expected 4 visible touch controls, saw ${report.touchVisible}`);

  await page.locator("#primaryButton").click();
  if ((await page.evaluate(() => window.__PACKRAT_SNAKE__.getState().state)) !== "playing") fail(slot, "Play did not enter playing state");
  await page.locator("#pauseButton").click();
  if ((await page.evaluate(() => window.__PACKRAT_SNAKE__.getState().state)) !== "paused") fail(slot, "Pause did not pause");
  await page.locator("#pauseButton").click();
  if ((await page.evaluate(() => window.__PACKRAT_SNAKE__.getState().state)) !== "playing") fail(slot, "Pause button did not resume");
  await page.locator("#restartButton").click();
  const restarted = await page.evaluate(() => window.__PACKRAT_SNAKE__.getState());
  if (restarted.state !== "ready" || restarted.score !== 0) fail(slot, "Restart did not reset to ready with score 0");

  const input = await page.evaluate(() => {
    const api = window.__PACKRAT_SNAKE__;
    api.setFixture({ state: "playing", direction: "right", inputQueue: [] });
    return {
      reverse: api.queueDirection("left"), first: api.queueDirection("up"),
      second: api.queueDirection("left"), overflow: api.queueDirection("down"),
      queue: api.getState().inputQueue
    };
  });
  if (input.reverse !== false || input.first !== true || input.second !== true || input.overflow !== false) fail(slot, `input queue behavior unexpected ${JSON.stringify(input)}`);
  if (input.queue.join(",") !== "up,left") fail(slot, `fast input queue became ${input.queue.join(",")}`);

  await page.evaluate(() => window.__PACKRAT_SNAKE__.setFixture({ state: "playing", direction: "right", inputQueue: [] }));
  await page.locator('.touch-zone[data-direction="up"]').dispatchEvent("pointerdown", { pointerId: 22, pointerType: "touch", isPrimary: true });
  if ((await page.evaluate(() => window.__PACKRAT_SNAKE__.getState().inputQueue[0])) !== "up") fail(slot, "touch directional zone did not queue direction");

  await page.evaluate(() => window.__PACKRAT_SNAKE__.setFixture({ state: "playing", direction: "right", inputQueue: [] }));
  const box = await page.locator("#boardShell").boundingBox();
  if (!box) fail(slot, "board missing for swipe test");
  else {
    const cx = box.x + box.width * .5;
    const cy = box.y + box.height * .55;
    await page.locator("#boardShell").dispatchEvent("pointerdown", { pointerId: 31, pointerType: "touch", clientX: cx, clientY: cy, button: 0 });
    await page.locator("#boardShell").dispatchEvent("pointerup", { pointerId: 31, pointerType: "touch", clientX: cx, clientY: cy - 70, button: 0 });
    if ((await page.evaluate(() => window.__PACKRAT_SNAKE__.getState().inputQueue[0])) !== "up") fail(slot, "up swipe did not queue up");
  }

  const wall = await page.evaluate(() => {
    const api = window.__PACKRAT_SNAKE__;
    api.setFixture({ snake: [{x:0,y:0},{x:1,y:0},{x:2,y:0}], food: {x:5,y:5}, direction: "left", state: "playing", score: 0 });
    api.step(); return api.getState();
  });
  if (wall.state !== "gameover") fail(slot, "wall collision did not end run");

  const selfHit = await page.evaluate(() => {
    const api = window.__PACKRAT_SNAKE__;
    api.setFixture({
      snake: [{x:2,y:2},{x:2,y:3},{x:1,y:3},{x:1,y:2},{x:1,y:1},{x:2,y:1},{x:3,y:1},{x:3,y:2}],
      food: {x:6,y:6}, direction: "down", state: "playing", score: 0
    });
    api.step(); return api.getState();
  });
  if (selfHit.state !== "gameover") fail(slot, "self collision did not end run");

  const tailMove = await page.evaluate(() => {
    const api = window.__PACKRAT_SNAKE__;
    api.setFixture({ snake: [{x:2,y:2},{x:2,y:3},{x:1,y:3},{x:1,y:2}], food: {x:7,y:7}, direction: "left", state: "playing", score: 0 });
    api.step(); return api.getState();
  });
  if (tailMove.state !== "playing" || tailMove.snake[0]?.x !== 1 || tailMove.snake[0]?.y !== 2) fail(slot, "legal tail-vacate move was rejected");

  const eat = await page.evaluate(() => {
    const api = window.__PACKRAT_SNAKE__;
    api.setFixture({ snake: [{x:2,y:2},{x:1,y:2},{x:0,y:2}], food: {x:3,y:2}, direction: "right", state: "playing", score: 0, highScore: 0 });
    api.step(); return api.getState();
  });
  if (eat.score !== 10 || eat.snake.length !== 4 || eat.highScore !== 10) fail(slot, `eating state wrong score=${eat.score} length=${eat.snake.length} best=${eat.highScore}`);
  if (eat.food && eat.snake.some(p => p.x === eat.food.x && p.y === eat.food.y)) fail(slot, "food respawned on snake");

  const foodEdge = await page.evaluate(() => {
    const api = window.__PACKRAT_SNAKE__;
    const { cols, rows } = api.getState().config;
    const last = { x: cols - 1, y: rows - 1 };
    const occupied = [];
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) if (x !== last.x || y !== last.y) occupied.push({x,y});
    return {
      only: api.chooseFood(occupied, cols, rows, .91),
      full: api.chooseFood([...occupied, last], cols, rows, .33),
      sparseA: api.chooseFood([{x:0,y:0}], cols, rows, 0),
      sparseB: api.chooseFood([{x:0,y:0}], cols, rows, .999999)
    };
  });
  const cfg = report.state.config;
  if (foodEdge.only?.x !== cfg.cols - 1 || foodEdge.only?.y !== cfg.rows - 1) fail(slot, `near-full food spawn failed ${JSON.stringify(foodEdge.only)}`);
  if (foodEdge.full !== null) fail(slot, "full board should return no food");
  if (foodEdge.sparseA?.x === 0 && foodEdge.sparseA?.y === 0) fail(slot, "sparse food spawned on occupied cell");
  if (foodEdge.sparseB?.x === 0 && foodEdge.sparseB?.y === 0) fail(slot, "sparse food spawned on occupied cell");

  const won = await page.evaluate(() => {
    const api = window.__PACKRAT_SNAKE__;
    const { cols, rows } = api.getState().config;
    const body = [];
    for (let y = 0; y < rows; y++) {
      const xs = y % 2 === 0 ? [...Array(cols).keys()] : [...Array(cols).keys()].reverse();
      for (const x of xs) if (!(x === 0 && y === 0)) body.push({x,y});
    }
    const headIndex = body.findIndex(p => p.x === 1 && p.y === 0);
    const ordered = body.slice(headIndex).concat(body.slice(0, headIndex));
    api.setFixture({ snake: ordered, food: {x:0,y:0}, direction: "left", state: "playing", score: 500, highScore: 500 });
    api.step(); return api.getState();
  });
  if (won.state !== "won" || won.food !== null) fail(slot, `full board did not enter won state (${won.state})`);

  await page.evaluate(() => {
    const api = window.__PACKRAT_SNAKE__;
    api.setFixture({ snake: [{x:5,y:5},{x:4,y:5},{x:3,y:5},{x:2,y:5}], food: {x:8,y:5}, direction: "right", state: "paused", score: 50, highScore: 120 });
    api.save();
  });
  await page.reload({ waitUntil: "load" });
  await page.waitForFunction(() => Boolean(window.__PACKRAT_SNAKE__));
  const persisted = await page.evaluate(() => window.__PACKRAT_SNAKE__.getState());
  if (persisted.score !== 50 || persisted.highScore !== 120 || persisted.state !== "paused") fail(slot, `persistence failed ${JSON.stringify({score:persisted.score, highScore:persisted.highScore, state:persisted.state})}`);
  if (!(await page.locator("#gameCanvas").isVisible())) fail(slot, "preview canvas not visible outside iCUE host");

  const bench = await page.evaluate(() => window.__PACKRAT_SNAKE__.benchmark(300));
  perf.push({ slot, averageMs: bench.averageMs, totalMs: bench.totalMs });
  if (bench.averageMs > 16) fail(slot, `draw benchmark ${bench.averageMs.toFixed(2)}ms average exceeds 16ms regression ceiling`);
  if (runtimeErrors.length) fail(slot, `runtime errors ${runtimeErrors.join(" | ")}`);
  await page.close();
}

await browser.close();
console.log("SNAKE PERFORMANCE");
for (const row of perf) console.log(`${row.slot}: ${row.averageMs.toFixed(3)} ms/draw (${row.totalMs.toFixed(1)} ms / 300)`);
if (failures.length) {
  console.error("SNAKE QA FAIL");
  for (const failure of failures) console.error(failure);
  process.exit(1);
}
console.log("SNAKE QA PASS: eight layouts, controls, swipe/touch input, reverse prevention, rapid input, wall/self/tail collision, scoring, food spawning, near-full/full board, persistence, restart/pause, preview mode, runtime and rendering benchmark passed");
