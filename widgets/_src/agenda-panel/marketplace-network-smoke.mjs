#!/usr/bin/env node
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

const entry = process.argv[2];
const outDir = process.argv[3] || "artifacts/calendar-marketplace-smoke";
if (!entry || !fs.existsSync(entry)) {
  console.error("usage: node marketplace-network-smoke.mjs <packaged-index.html> [output-dir]");
  process.exit(2);
}
fs.mkdirSync(outDir, { recursive: true });

function ymd(date) {
  return String(date.getUTCFullYear()) + String(date.getUTCMonth() + 1).padStart(2, "0") + String(date.getUTCDate()).padStart(2, "0");
}
const today = new Date();
const tomorrow = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 1));
const ics = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "PRODID:-//PackRat//Calendar Marketplace Smoke//EN",
  "BEGIN:VEVENT",
  "UID:packrat-marketplace-calendar-smoke",
  "DTSTART;VALUE=DATE:" + ymd(today),
  "DTEND;VALUE=DATE:" + ymd(tomorrow),
  "SUMMARY:Marketplace Calendar Fixture",
  "LOCATION:PackRat QA",
  "END:VEVENT",
  "END:VCALENDAR",
  ""
].join("\r\n");

let requests = 0;
const server = http.createServer((req, res) => {
  if (req.url === "/calendar.ics") {
    requests += 1;
    res.writeHead(200, {
      "Content-Type": "text/calendar; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store"
    });
    res.end(ics);
    return;
  }
  res.writeHead(404, { "Access-Control-Allow-Origin": "*" });
  res.end("not found");
});
await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", resolve);
});
const port = server.address().port;
const feedUrl = `http://127.0.0.1:${port}/calendar.ics`;

const report = {
  schema_version: 1,
  entry: path.basename(entry),
  feedUrl,
  requests: 0,
  initialState: null,
  loadedState: null,
  clearedState: null,
  bridge: null,
  runtimeErrors: [],
  passed: false
};

const init = `
let calendarUrl1 = "";
let calendarUrl2 = "";
let calendarUrl3 = "";
let refreshMinutes = 15;
let use24Hour = false;
let textColor = "#E9EEF2";
let accentColor = "#19A8FF";
let backgroundColor = "#071018";
let uniqueId = "ratpack-calendar-marketplace-smoke";
let iCUE_initialized = false;
globalThis.tr = async function (value) { return value; };
`;

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1688, height: 696 } });
await context.addInitScript({ content: init });
const page = await context.newPage();
page.on("pageerror", (error) => report.runtimeErrors.push(String(error)));
page.on("console", (message) => {
  if (message.type() === "error") report.runtimeErrors.push(message.text());
});

async function state() {
  return page.evaluate(() => ({
    bodyState: document.body?.getAttribute("data-state") || "",
    heroTitle: document.getElementById("heroTitle")?.textContent || "",
    freshness: document.getElementById("freshnessLabel")?.textContent || "",
    calendarUrl1: globalThis.calendarUrl1,
    text: document.documentElement.style.getPropertyValue("--text"),
    accent: document.documentElement.style.getPropertyValue("--accent"),
    background: document.documentElement.style.getPropertyValue("--bg")
  }));
}

let exitCode = 0;
try {
  await page.goto(pathToFileURL(path.resolve(entry)).href, { waitUntil: "load", timeout: 30_000 });
  await page.waitForFunction(() => document.body?.getAttribute("data-state") === "unconfigured", { timeout: 10_000 });
  report.bridge = await page.evaluate(() => globalThis.__ratpackIcueBindingBridge || null);
  if (!report.bridge || !Array.isArray(report.bridge.names) || !report.bridge.names.includes("calendarUrl1")) {
    throw new Error("packaged Calendar widget is missing live calendarUrl1 binding bridge");
  }
  report.initialState = await state();

  await page.evaluate(`
    calendarUrl1 = ${JSON.stringify(feedUrl)};
    textColor = "#FFF3D6";
    accentColor = "#FF274D";
    backgroundColor = "#18100B";
    if (globalThis.icueEvents && typeof globalThis.icueEvents.onDataUpdated === "function") globalThis.icueEvents.onDataUpdated();
  `);
  await page.waitForFunction(() => document.getElementById("heroTitle")?.textContent === "Marketplace Calendar Fixture", { timeout: 15_000 });
  await page.waitForFunction(() => document.body?.getAttribute("data-state") === "fresh", { timeout: 5_000 });
  report.loadedState = await state();
  report.requests = requests;
  if (requests < 1) throw new Error("calendarUrl1 update never reached the configured ICS endpoint");
  if (String(report.loadedState.calendarUrl1) !== feedUrl) throw new Error("calendarUrl1 live binding did not update");
  if (report.loadedState.accent.trim().toLowerCase() !== "#ff274d") throw new Error("Calendar native accent did not update after onDataUpdated");

  await page.evaluate(`
    calendarUrl1 = "";
    if (globalThis.icueEvents && typeof globalThis.icueEvents.onDataUpdated === "function") globalThis.icueEvents.onDataUpdated();
  `);
  await page.waitForFunction(() => document.body?.getAttribute("data-state") === "unconfigured", { timeout: 8_000 });
  report.clearedState = await state();

  if (report.runtimeErrors.length) throw new Error(`runtime errors: ${JSON.stringify(report.runtimeErrors)}`);
  await page.screenshot({ path: path.join(outDir, "calendar-marketplace-smoke.png") });
  report.passed = true;
} catch (error) {
  report.error = String(error?.stack || error);
  exitCode = 1;
} finally {
  report.requests = requests;
  fs.writeFileSync(path.join(outDir, "calendar-marketplace-result.json"), JSON.stringify(report, null, 2) + "\n");
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

console.log(JSON.stringify(report, null, 2));
process.exit(exitCode);
