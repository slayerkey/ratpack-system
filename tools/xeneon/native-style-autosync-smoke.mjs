#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

const entry = process.argv[2];
const outDir = process.argv[3] || "artifacts/native-style-autosync";
if (!entry || !fs.existsSync(entry)) {
  console.error("usage: node native-style-autosync-smoke.mjs <packaged-index.html> [output-dir]");
  process.exit(2);
}
fs.mkdirSync(outDir, { recursive: true });

const html = fs.readFileSync(entry, "utf8");
const before = { text: "#E9EEF2", accent: "#19A8FF", background: "#071018" };
const after = { text: "#FFF3D6", accent: "#FF274D", background: "#18100B" };
const harness = `<script id="ratpack-native-style-autosync-harness">
let textColor = ${JSON.stringify(before.text)};
let accentColor = ${JSON.stringify(before.accent)};
let backgroundColor = ${JSON.stringify(before.background)};
let graphColor = ${JSON.stringify(before.accent)};
let iCUE_initialized = false;
let uniqueId = "ratpack-native-style-autosync";
globalThis.tr = async function (value) { return value; };
globalThis.__setRatpackIcueStyleAutosync = function (next) {
  textColor = String(next.text);
  accentColor = String(next.accent);
  backgroundColor = String(next.background);
  graphColor = String(next.accent);
};
</script>`;
if (!/<head(?:\s[^>]*)?>/i.test(html)) throw new Error("packaged widget is missing <head>");
const instrumentedHtml = html.replace(/<head(\s[^>]*)?>/i, (match) => match + "\n" + harness);
const instrumentedEntry = path.join(path.dirname(path.resolve(entry)), "__ratpack-native-style-autosync.html");
fs.writeFileSync(instrumentedEntry, instrumentedHtml, "utf8");

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1688, height: 696 } });
const page = await context.newPage();
const report = { schema_version: 1, entry: path.basename(entry), passed: false };
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(String(error)));

const norm = (value) => String(value || "").trim().toLowerCase().replace(/\s+/g, "");
async function vars() {
  return page.evaluate(() => {
    const root = document.documentElement;
    const css = getComputedStyle(root);
    const first = (...names) => {
      for (const name of names) {
        const value = root.style.getPropertyValue(name) || css.getPropertyValue(name);
        if (String(value || "").trim()) return String(value).trim();
      }
      return "";
    };
    return {
      text: first("--text", "--text-color"),
      accent: first("--accent", "--accent-color"),
      background: first("--background", "--bg", "--background-color"),
      bridge: globalThis.__ratpackIcueBindingBridge || null,
      sync: globalThis.__ratpackIcueBindingSync || null,
    };
  });
}

let exitCode = 0;
try {
  await page.goto(pathToFileURL(instrumentedEntry).href, { waitUntil: "load", timeout: 30_000 });
  await page.waitForTimeout(500);
  report.initial = await vars();
  if (!report.initial.bridge || report.initial.bridge.mode !== "direct-binding") throw new Error("direct iCUE binding bridge missing");

  await page.evaluate((next) => {
    if (typeof globalThis.__setRatpackIcueStyleAutosync !== "function") throw new Error("autosync setter missing");
    globalThis.__setRatpackIcueStyleAutosync(next);
    // Intentionally do NOT call icueEvents.onDataUpdated(). Real-host recovery
    // requires live bindings to be noticed without depending on callback timing.
  }, after);

  await page.waitForFunction((expected) => {
    const root = document.documentElement;
    const css = getComputedStyle(root);
    const pick = (...names) => {
      for (const name of names) {
        const value = root.style.getPropertyValue(name) || css.getPropertyValue(name);
        if (String(value || "").trim()) return String(value).trim().toLowerCase().replace(/\s+/g, "");
      }
      return "";
    };
    const normalize = (v) => String(v || "").trim().toLowerCase().replace(/\s+/g, "");
    return pick("--text", "--text-color") === normalize(expected.text)
      && pick("--accent", "--accent-color") === normalize(expected.accent)
      && pick("--background", "--bg", "--background-color") === normalize(expected.background);
  }, after, { timeout: 3000 });

  report.updated = await vars();
  if (norm(report.updated.text) !== norm(after.text)) throw new Error("text did not autosync");
  if (norm(report.updated.accent) !== norm(after.accent)) throw new Error("accent did not autosync");
  if (norm(report.updated.background) !== norm(after.background)) throw new Error("background did not autosync");
  if (pageErrors.length) throw new Error(`page errors: ${JSON.stringify(pageErrors)}`);
  await page.screenshot({ path: path.join(outDir, "native-style-autosync.png") });
  report.passed = true;
} catch (error) {
  report.error = String(error?.stack || error);
  exitCode = 1;
} finally {
  report.pageErrors = pageErrors;
  fs.writeFileSync(path.join(outDir, "native-style-autosync-result.json"), JSON.stringify(report, null, 2) + "\n");
  try { fs.unlinkSync(instrumentedEntry); } catch {}
  await browser.close();
}

console.log(JSON.stringify(report, null, 2));
process.exit(exitCode);
