import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";

const packagePath = process.argv[2];
const outputDir = process.argv[3] || "artifacts/streamspell";
const site = process.env.STREAMSPELL_URL || "https://icue-widgets.streamspell.com/";

if (!packagePath) {
  console.error("Usage: node tools/xeneon/streamspell.mjs <package.icuewidget> [output-dir]");
  process.exit(2);
}

if (!fs.existsSync(packagePath)) {
  console.error(`Package not found: ${packagePath}`);
  process.exit(2);
}

fs.mkdirSync(outputDir, { recursive: true });

const expectedPresets = [
  "XENEON_S_H",
  "XENEON_S_V",
  "XENEON_M_H",
  "XENEON_M_V",
  "XENEON_L_H",
  "XENEON_L_V",
  "XENEON_XL_H",
  "XENEON_XL_V",
];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1800, height: 1250 } });
const consoleErrors = [];

page.on("console", (msg) => {
  if (msg.type() !== "error") return;
  const text = msg.text();
  if (/CORS|Failed to load resource|net::ERR|Access to fetch/i.test(text)) return;
  consoleErrors.push(text.slice(0, 240));
});

let exitCode = 0;
const result = {
  site,
  package: path.basename(packagePath),
  validation: null,
  presets: [],
  consoleErrors,
};

try {
  await page.goto(site, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForSelector("#widgetFile", { timeout: 30_000 });
  await page.setInputFiles("#widgetFile", packagePath);

  await page.waitForFunction(() => {
    const active = (document.getElementById("activeWidgetName")?.textContent || "").trim();
    const badge = (document.getElementById("validationBadge")?.textContent || "").trim();
    return Boolean(active) && Boolean(badge) && !/^idle$/i.test(badge);
  }, { timeout: 45_000 }).catch(() => {});

  await page.waitForTimeout(2_000);

  const info = await page.evaluate(() => {
    const txt = (id) => (document.getElementById(id)?.textContent || "").trim().replace(/\s+/g, " ");
    const options = Array.from(document.querySelectorAll("#viewportSelect option"))
      .map((option) => option.value)
      .filter(Boolean);
    return {
      badge: txt("validationBadge"),
      summary: txt("validationSummary"),
      details: txt("validationDetails"),
      status: txt("statusMessage"),
      active: txt("activeWidgetName"),
      options,
    };
  });

  result.validation = info;
  const badValidation = /invalid|error|fail/i.test(`${info.badge} ${info.summary}`);
  if (!info.active || badValidation) exitCode = 1;

  const availablePresets = expectedPresets.filter((preset) => info.options.includes(preset));
  if (availablePresets.length !== expectedPresets.length) {
    const missing = expectedPresets.filter((preset) => !info.options.includes(preset));
    console.error(`Missing StreamSpell viewport presets: ${missing.join(", ")}`);
    exitCode = 1;
  }

  for (const preset of availablePresets) {
    await page.selectOption("#viewportSelect", preset);
    await page.waitForTimeout(900);

    const frame = page.locator("#widgetFrame");
    const screenshot = path.join(outputDir, `${preset}.png`);
    await frame.screenshot({ path: screenshot });

    const frameBox = await frame.boundingBox();
    result.presets.push({
      preset,
      screenshot: path.basename(screenshot),
      rendered: Boolean(frameBox && frameBox.width > 0 && frameBox.height > 0),
      width: frameBox?.width || 0,
      height: frameBox?.height || 0,
    });

    if (!frameBox || frameBox.width <= 0 || frameBox.height <= 0) exitCode = 1;
  }

  if (consoleErrors.length) exitCode = 1;
} catch (error) {
  result.error = String(error?.stack || error);
  exitCode = 1;
} finally {
  fs.writeFileSync(path.join(outputDir, "streamspell-result.json"), JSON.stringify(result, null, 2));
  await browser.close();
}

console.log(JSON.stringify(result, null, 2));
process.exit(exitCode);
