#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

const entry = process.argv[2];
const outDir = process.argv[3] || "artifacts/marketplace-network-smoke";
if (!entry || !fs.existsSync(entry)) {
  console.error("usage: node marketplace-network-smoke.mjs <packaged-index.html> [output-dir]");
  process.exit(2);
}
fs.mkdirSync(outDir, { recursive: true });

const API_PREFIX = "https://api.helldivers2.dev/api/v1/";
const report = {
  schema_version: 2,
  transport: API_PREFIX,
  getRequests: [],
  failedRequests: [],
  statuses: [],
  connectionState: null,
  badge: null,
  recoveryMarker: null,
  passed: false,
};

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1688, height: 696 } });
await context.addInitScript({ content: `
let refreshMinutes = 30;
let showTicker = false;
let textColor = "#F4F6F8";
let accentColor = "#2BE86A";
let backgroundColor = "#05080C";
let iCUE_initialized = true;
let uniqueId = "ratpack-helldivers-marketplace-smoke";
globalThis.tr = async function (value) { return value; };
` });
const page = await context.newPage();
const runtimeErrors = [];
page.on("pageerror", (error) => runtimeErrors.push(String(error)));
page.on("request", (request) => {
  if (request.method() === "GET" && request.url().startsWith(API_PREFIX)) report.getRequests.push(request.url());
});
page.on("requestfailed", (request) => {
  if (request.url().startsWith(API_PREFIX)) {
    report.failedRequests.push({ url: request.url(), method: request.method(), error: request.failure()?.errorText || "unknown" });
  }
});
page.on("response", (response) => {
  if (response.request().method() === "GET" && response.url().startsWith(API_PREFIX)) {
    report.statuses.push({ url: response.url(), status: response.status() });
  }
});

let exitCode = 0;
try {
  await page.goto(pathToFileURL(path.resolve(entry)).href, { waitUntil: "load", timeout: 30_000 });
  await page.waitForFunction(() => {
    const state = document.body?.getAttribute("data-connection");
    return state === "live" || state === "stale" || state === "rate" || state === "offline" || state === "bad" || state === "network" || state === "empty";
  }, { timeout: 20_000 });

  // iCUE may call this after the DOM startup path has already run. The recovery
  // must not issue a second four-endpoint burst.
  await page.evaluate(() => {
    if (globalThis.icueEvents && typeof globalThis.icueEvents.onICUEInitialized === "function") globalThis.icueEvents.onICUEInitialized();
  });
  await page.waitForTimeout(2500);

  report.connectionState = await page.evaluate(() => document.body?.getAttribute("data-connection") || "");
  report.badge = await page.evaluate(() => document.getElementById("connectionBadge")?.textContent || "");
  report.recoveryMarker = await page.evaluate(() => globalThis.__packratHelldiversRecovery || null);
  report.uniqueGetRequests = [...new Set(report.getRequests)];

  if (!report.recoveryMarker || report.recoveryMarker.version !== 2 || report.recoveryMarker.transport !== "query") throw new Error("Helldivers query-transport recovery patch missing from packaged widget");
  if (report.getRequests.length > 4) throw new Error(`duplicate startup fetch burst detected: ${report.getRequests.length} GETs`);
  if (report.uniqueGetRequests.length !== 4) throw new Error(`expected four production endpoints, saw ${report.uniqueGetRequests.length}`);
  for (const url of report.uniqueGetRequests) {
    const parsed = new URL(url);
    if (parsed.searchParams.get("x-super-client") !== "packrat-xeneon") throw new Error(`missing x-super-client query credential: ${url}`);
    if (!parsed.searchParams.get("x-super-contact")) throw new Error(`missing x-super-contact query credential: ${url}`);
  }
  if (report.statuses.some((item) => item.status === 429)) throw new Error(`production API rate limited clean startup: ${JSON.stringify(report.statuses)}`);
  if (!report.statuses.some((item) => item.status >= 200 && item.status < 300)) throw new Error(`no successful production API response: statuses=${JSON.stringify(report.statuses)} failed=${JSON.stringify(report.failedRequests)}`);
  if (!new Set(["live", "stale"]).has(report.connectionState)) throw new Error(`packaged widget did not reach usable data state: ${report.connectionState} / ${report.badge}`);

  await page.screenshot({ path: path.join(outDir, "helldivers-live.png") });
  report.passed = true;
} catch (error) {
  report.error = String(error?.stack || error);
  exitCode = 1;
} finally {
  report.runtimeErrors = runtimeErrors;
  fs.writeFileSync(path.join(outDir, "marketplace-network-result.json"), JSON.stringify(report, null, 2) + "\n");
  await browser.close();
}

console.log(JSON.stringify(report, null, 2));
process.exit(exitCode);
