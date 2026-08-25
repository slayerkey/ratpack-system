#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

const entry = process.argv[2];
const outDir = process.argv[3] || "artifacts/native-style-smoke";
if (!entry || !fs.existsSync(entry)) {
  console.error("usage: node native-style-smoke.mjs <packaged-index.html> [output-dir]");
  process.exit(2);
}
fs.mkdirSync(outDir, { recursive: true });

const html = fs.readFileSync(entry, "utf8");
const required = ["textColor", "accentColor", "backgroundColor"];
const declared = required.filter((name) => new RegExp(`name=[\"']x-icue-property[\"'][^>]*content=[\"']${name}[\"']|content=[\"']${name}[\"'][^>]*name=[\"']x-icue-property[\"']`, "i").test(html));
const report = {
  schema_version: 1,
  entry: path.basename(entry),
  declared,
  initial: null,
  updated: null,
  bridge: null,
  passed: false,
};

if (declared.length !== required.length) {
  report.skipped = true;
  report.reason = "widget does not declare the complete native Custom Style triplet";
  fs.writeFileSync(path.join(outDir, "native-style-result.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

const before = { text: "#E9EEF2", accent: "#19A8FF", background: "#071018" };
const after = { text: "#FFF3D6", accent: "#FF274D", background: "#18100B" };
const init = `
let textColor = ${JSON.stringify(before.text)};
let accentColor = ${JSON.stringify(before.accent)};
let backgroundColor = ${JSON.stringify(before.background)};
let gradientMotion = 0;
let iCUE_initialized = false;
let uniqueId = "ratpack-native-style-smoke";
globalThis.tr = async function (value) { return value; };
`;

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1688, height: 696 } });
await context.addInitScript({ content: init });
const page = await context.newPage();
const runtimeErrors = [];
page.on("pageerror", (error) => runtimeErrors.push(String(error)));

function normalize(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, "");
}

async function snapshot() {
  return page.evaluate(() => {
    const root = document.documentElement;
    const css = getComputedStyle(root);
    return {
      textBinding: globalThis.textColor,
      accentBinding: globalThis.accentColor,
      backgroundBinding: globalThis.backgroundColor,
      textVar: root.style.getPropertyValue("--text") || css.getPropertyValue("--text"),
      accentVar: root.style.getPropertyValue("--accent") || css.getPropertyValue("--accent"),
      backgroundVar: root.style.getPropertyValue("--bg") || css.getPropertyValue("--bg"),
      bodyState: document.body ? document.body.getAttribute("data-connection") || document.body.getAttribute("data-state") || "" : "",
    };
  });
}

let exitCode = 0;
try {
  await page.goto(pathToFileURL(path.resolve(entry)).href, { waitUntil: "load", timeout: 30_000 });
  await page.waitForTimeout(350);
  report.bridge = await page.evaluate(() => globalThis.__ratpackIcueBindingBridge || null);
  if (!report.bridge || report.bridge.version !== 1) throw new Error("packaged widget is missing RatPack iCUE binding bridge");

  report.initial = await snapshot();
  for (const [key, expected] of [
    ["textBinding", before.text],
    ["accentBinding", before.accent],
    ["backgroundBinding", before.background],
  ]) {
    if (normalize(report.initial[key]) !== normalize(expected)) throw new Error(`initial ${key} mismatch: ${report.initial[key]} != ${expected}`);
  }

  await page.evaluate(`
    textColor = ${JSON.stringify(after.text)};
    accentColor = ${JSON.stringify(after.accent)};
    backgroundColor = ${JSON.stringify(after.background)};
    if (globalThis.icueEvents && typeof globalThis.icueEvents.onDataUpdated === "function") globalThis.icueEvents.onDataUpdated();
  `);
  await page.waitForTimeout(450);
  report.updated = await snapshot();

  for (const [key, expected] of [
    ["textBinding", after.text],
    ["accentBinding", after.accent],
    ["backgroundBinding", after.background],
    ["textVar", after.text],
    ["accentVar", after.accent],
    ["backgroundVar", after.background],
  ]) {
    if (normalize(report.updated[key]) !== normalize(expected)) throw new Error(`updated ${key} mismatch: ${report.updated[key]} != ${expected}`);
  }

  await page.screenshot({ path: path.join(outDir, "native-style-updated.png") });
  report.passed = true;
} catch (error) {
  report.error = String(error?.stack || error);
  exitCode = 1;
} finally {
  report.runtimeErrors = runtimeErrors;
  fs.writeFileSync(path.join(outDir, "native-style-result.json"), JSON.stringify(report, null, 2) + "\n");
  await browser.close();
}

console.log(JSON.stringify(report, null, 2));
process.exit(exitCode);
