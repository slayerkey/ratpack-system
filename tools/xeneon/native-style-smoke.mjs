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
  schema_version: 3,
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

// iCUE property controls are JavaScript bindings in the widget document. Playwright's
// addInitScript runs in a different initialization context and does not reproduce that
// global lexical environment faithfully. Instrument a copy of the exact packaged HTML
// with one classic script before RatPack's bridge, so the test exercises the same
// document-level binding semantics that iCUE uses while leaving the official package
// artifact itself untouched.
const harness = `<script id="ratpack-native-style-harness">
let textColor = ${JSON.stringify(before.text)};
let accentColor = ${JSON.stringify(before.accent)};
let backgroundColor = ${JSON.stringify(before.background)};
let gradientMotion = 0;
let iCUE_initialized = false;
let uniqueId = "ratpack-native-style-smoke";
globalThis.tr = async function (value) { return value; };
globalThis.__setRatpackIcueStyleSmoke = function (next) {
  textColor = String(next.text);
  accentColor = String(next.accent);
  backgroundColor = String(next.background);
};
</script>`;

if (!/<head(?:\s[^>]*)?>/i.test(html)) {
  console.error("packaged widget is missing <head>");
  process.exit(2);
}
const instrumentedHtml = html.replace(/<head(\s[^>]*)?>/i, (match) => match + "\n" + harness);
const instrumentedEntry = path.join(path.dirname(path.resolve(entry)), "__ratpack-native-style-instrumented.html");
fs.writeFileSync(instrumentedEntry, instrumentedHtml, "utf8");
report.instrumentedEntry = path.basename(instrumentedEntry);

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1688, height: 696 } });
const page = await context.newPage();
const pageErrors = [];
const consoleErrors = [];
page.on("pageerror", (error) => pageErrors.push(String(error)));
// Network-capable widgets can legitimately emit browser console connection errors while
// a native-style-only smoke runs without their external service. Preserve those messages
// as evidence, but leave transport correctness to each product's packaged network smoke.
page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});

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
  await page.goto(pathToFileURL(instrumentedEntry).href, { waitUntil: "load", timeout: 30_000 });
  await page.waitForTimeout(400);
  report.bridge = await page.evaluate(() => globalThis.__ratpackIcueBindingBridge || null);
  if (!report.bridge || report.bridge.version !== 1) throw new Error("packaged widget is missing RatPack iCUE binding bridge");

  report.initial = await snapshot();
  for (const [key, expected] of [
    ["textBinding", before.text],
    ["accentBinding", before.accent],
    ["backgroundBinding", before.background],
    ["textVar", before.text],
    ["accentVar", before.accent],
    ["backgroundVar", before.background],
  ]) {
    if (normalize(report.initial[key]) !== normalize(expected)) throw new Error(`initial ${key} mismatch: ${report.initial[key]} != ${expected}`);
  }

  await page.evaluate((next) => {
    if (typeof globalThis.__setRatpackIcueStyleSmoke !== "function") throw new Error("native style harness setter missing");
    globalThis.__setRatpackIcueStyleSmoke(next);
    if (globalThis.icueEvents && typeof globalThis.icueEvents.onDataUpdated === "function") globalThis.icueEvents.onDataUpdated();
  }, after);
  await page.waitForTimeout(500);
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

  if (pageErrors.length) throw new Error(`page errors: ${JSON.stringify(pageErrors)}`);
  await page.screenshot({ path: path.join(outDir, "native-style-updated.png") });
  report.passed = true;
} catch (error) {
  report.error = String(error?.stack || error);
  exitCode = 1;
} finally {
  report.pageErrors = pageErrors;
  report.consoleErrors = consoleErrors;
  fs.writeFileSync(path.join(outDir, "native-style-result.json"), JSON.stringify(report, null, 2) + "\n");
  try { fs.unlinkSync(instrumentedEntry); } catch {}
  await browser.close();
}

console.log(JSON.stringify(report, null, 2));
process.exit(exitCode);
