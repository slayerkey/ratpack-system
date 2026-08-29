#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

const entry = process.argv[2];
const outDir = process.argv[3] || "artifacts/net-dashboard-ui";
if (!entry || !fs.existsSync(entry)) {
  console.error("usage: node net-dashboard-ui-smoke.mjs <index.html> [out-dir]");
  process.exit(2);
}
fs.mkdirSync(outDir, { recursive: true });

const original = fs.readFileSync(entry, "utf8");
const harness = `<script id="ratpack-net-ui-harness">
let probeHosts = "";
let probeInterval = 10;
let warnAt = 100;
let customHeader = "MY NETWORK";
let hostTextSize = 22;
let textColor = "#F4F6F8";
let accentColor = "#2BE86A";
let backgroundColor = "#07090D";
let transparency = 35;
let uniqueId = "ratpack-network-ui-smoke";
globalThis.tr = async function(value){ return value; };
globalThis.__setNetworkUi = function(next) {
  if (next.customHeader !== undefined) customHeader = String(next.customHeader);
  if (next.hostTextSize !== undefined) hostTextSize = Number(next.hostTextSize);
  if (next.transparency !== undefined) transparency = Number(next.transparency);
};
</script>`;
const instrumented = original.replace(/<head(\s[^>]*)?>/i, (match) => match + "\n" + harness);
const temp = path.join(path.dirname(path.resolve(entry)), "__ratpack-net-ui-instrumented.html");
fs.writeFileSync(temp, instrumented, "utf8");

const report = { schema_version: 1, entry: path.basename(entry), passed: false };
let exitCode = 0;
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 840, height: 344 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(String(error)));
  await page.goto(pathToFileURL(temp).href, { waitUntil: "load", timeout: 30_000 });
  await page.waitForFunction(() => Boolean(globalThis.__netDashboardUiTest && globalThis.icueEvents), null, { timeout: 10_000 });
  await page.waitForFunction(() => document.getElementById("ribbonEyebrow")?.textContent === "MY NETWORK", null, { timeout: 5_000 });

  report.initial = await page.evaluate(() => ({
    header: document.getElementById("ribbonEyebrow")?.textContent,
    hostSize: getComputedStyle(document.documentElement).getPropertyValue("--net-user-host-size").trim(),
    backgroundFactor: getComputedStyle(document.documentElement).getPropertyValue("--net-background-factor").trim(),
    slot: document.body.getAttribute("data-slot")
  }));
  if (report.initial.header !== "MY NETWORK") throw new Error(`custom header missing: ${JSON.stringify(report.initial)}`);
  if (report.initial.hostSize !== "22px") throw new Error(`host size setting missing: ${JSON.stringify(report.initial)}`);
  if (Math.abs(Number(report.initial.backgroundFactor) - 0.35) > 0.001) throw new Error(`transparency setting missing: ${JSON.stringify(report.initial)}`);
  if (report.initial.slot !== "s-h") throw new Error(`small composition not detected: ${JSON.stringify(report.initial)}`);

  await page.evaluate(() => {
    globalThis.__setNetworkUi({ customHeader: "", hostTextSize: 18, transparency: 70 });
    globalThis.icueEvents.onDataUpdated();
  });
  await page.waitForFunction(() => document.getElementById("ribbonEyebrow")?.textContent === "LATENCY HISTORY", null, { timeout: 5_000 });
  report.updated = await page.evaluate(() => ({
    header: document.getElementById("ribbonEyebrow")?.textContent,
    hostSize: getComputedStyle(document.documentElement).getPropertyValue("--net-user-host-size").trim(),
    backgroundFactor: getComputedStyle(document.documentElement).getPropertyValue("--net-background-factor").trim()
  }));
  if (report.updated.hostSize !== "18px") throw new Error(`live host size update failed: ${JSON.stringify(report.updated)}`);
  if (Math.abs(Number(report.updated.backgroundFactor) - 0.70) > 0.001) throw new Error(`live transparency update failed: ${JSON.stringify(report.updated)}`);

  report.pageErrors = pageErrors;
  if (pageErrors.length) throw new Error(`runtime page errors: ${JSON.stringify(pageErrors)}`);
  await page.screenshot({ path: path.join(outDir, "network-dashboard-small-readable.png") });
  await context.close();
  report.passed = true;
} catch (error) {
  report.error = String(error?.stack || error);
  exitCode = 1;
} finally {
  fs.writeFileSync(path.join(outDir, "net-dashboard-ui-result.json"), JSON.stringify(report, null, 2) + "\n");
  try { fs.unlinkSync(temp); } catch {}
  await browser.close();
}
console.log(JSON.stringify(report, null, 2));
process.exit(exitCode);
