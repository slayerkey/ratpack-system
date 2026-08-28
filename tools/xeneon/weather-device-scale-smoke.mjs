#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

const entry = process.argv[2];
const outDir = process.argv[3] || "artifacts/weather-device-scale";
if (!entry || !fs.existsSync(entry)) {
  console.error("usage: node weather-device-scale-smoke.mjs <packaged-index.html> [output-dir]");
  process.exit(2);
}
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const report = { schema_version: 2, entry: path.basename(entry), passed: false };
let exitCode = 0;
try {
  const context = await browser.newContext({ viewport: { width: 2536, height: 696 } });
  const page = await context.newPage();
  await page.addInitScript(() => {
    globalThis.__weatherTimelineFixture = "rain";
    globalThis.location1 = "Phoenix";
    globalThis.temperatureUnits = "f";
    globalThis.theme = "sky";
    globalThis.refreshMinutes = 20;
    globalThis.weatherApiKey = "";
    globalThis.uniqueId = "weather-device-scale";
    globalThis.tr = async (value) => value;
  });
  await page.goto(pathToFileURL(path.resolve(entry)).href, { waitUntil: "load", timeout: 30_000 });
  await page.waitForFunction(() => document.getElementById("weatherStage")?.getAttribute("data-ready") === "true", null, { timeout: 10_000 });
  await page.waitForFunction(() => document.querySelectorAll(".hour").length >= 12, null, { timeout: 10_000 });

  report.device = await page.evaluate(() => {
    const px = (selector, prop = "fontSize") => parseFloat(getComputedStyle(document.querySelector(selector))[prop]) || 0;
    const rect = (selector) => document.querySelector(selector).getBoundingClientRect();
    return {
      viewport: [innerWidth, innerHeight],
      slot: document.body.getAttribute("data-slot"),
      currentTempPx: px("#currentTemp"),
      currentIconPx: rect("#currentIcon").width,
      locationPx: px("#locationName"),
      hourTimePx: px(".hour-time"),
      hourTempPx: px(".hour-temp"),
      hourIconPx: rect(".wx-icon").width,
      rainPx: px(".hour-rain em"),
      timelineHeaderPx: px(".eyebrow"),
      hourCount: document.querySelectorAll(".hour").length,
    };
  });

  const d = report.device;
  if (d.viewport[0] !== 2536 || d.viewport[1] !== 696) throw new Error(`wrong device viewport: ${JSON.stringify(d)}`);
  if (d.currentTempPx < 70) throw new Error(`current temperature too small on device: ${d.currentTempPx}px`);
  if (d.currentIconPx < 75) throw new Error(`current icon too small on device: ${d.currentIconPx}px`);
  if (d.locationPx < 20) throw new Error(`location text too small on device: ${d.locationPx}px`);
  if (d.hourTimePx < 14) throw new Error(`hour time too small on device: ${d.hourTimePx}px`);
  if (d.hourTempPx < 29) throw new Error(`hour temperature too small on device: ${d.hourTempPx}px`);
  if (d.hourIconPx < 55) throw new Error(`hour icon too small on device: ${d.hourIconPx}px`);
  if (d.rainPx < 12) throw new Error(`precipitation text too small on device: ${d.rainPx}px`);
  if (d.timelineHeaderPx < 14) throw new Error(`timeline heading too small on device: ${d.timelineHeaderPx}px`);

  await page.screenshot({ path: path.join(outDir, "weather-xl-2536x696.png") });
  await context.close();
  report.passed = true;
} catch (error) {
  report.error = String(error?.stack || error);
  exitCode = 1;
} finally {
  fs.writeFileSync(path.join(outDir, "weather-device-scale-result.json"), JSON.stringify(report, null, 2) + "\n");
  await browser.close();
}
console.log(JSON.stringify(report, null, 2));
process.exit(exitCode);
