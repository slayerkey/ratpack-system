#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

const entry = process.argv[2];
const outDir = process.argv[3] || "artifacts/desk-notes-settings";
if (!entry || !fs.existsSync(entry)) {
  console.error("usage: node tools/xeneon/desk-notes-settings-smoke.mjs <packaged-index.html> [output-dir]");
  process.exit(2);
}
fs.mkdirSync(outDir, { recursive: true });

const html = fs.readFileSync(entry, "utf8");
const isPro = /content=["']board1Title["']/i.test(html);
const required = isPro ? ["board1Title", "board1Entry1"] : ["boardTitle", "entry1"];
for (const name of required) {
  const pattern = new RegExp(`name=[\"']x-icue-property[\"'][^>]*content=[\"']${name}[\"']|content=[\"']${name}[\"'][^>]*name=[\"']x-icue-property[\"']`, "i");
  if (!pattern.test(html)) {
    console.error(`packaged Desk Notes widget is missing required property ${name}`);
    process.exit(2);
  }
}

const beforeTitle = "TODAY";
const beforeEntry = "[ ] Before settings update";
const afterTitle = "QA BOARD";
const afterEntry = "[ ] Settings path works";
const harness = `<script id="ratpack-desk-notes-settings-harness">
let boardTitle = ${JSON.stringify(beforeTitle)};
let entry1 = ${JSON.stringify(beforeEntry)};
let board1Title = ${JSON.stringify(beforeTitle)};
let board1Entry1 = ${JSON.stringify(beforeEntry)};
let iCUE_initialized = false;
let uniqueId = "ratpack-desk-notes-settings-smoke";
globalThis.tr = async function (value) { return value; };
globalThis.__setDeskNotesSettingsSmoke = function () {
  boardTitle = ${JSON.stringify(afterTitle)};
  entry1 = ${JSON.stringify(afterEntry)};
  board1Title = ${JSON.stringify(afterTitle)};
  board1Entry1 = ${JSON.stringify(afterEntry)};
};
</script>`;
if (!/<head(?:\s[^>]*)?>/i.test(html)) throw new Error("packaged widget is missing <head>");
const instrumented = html.replace(/<head(\s[^>]*)?>/i, (match) => match + "\n" + harness);
const instrumentedEntry = path.join(path.dirname(path.resolve(entry)), "__ratpack-desk-notes-settings.html");
fs.writeFileSync(instrumentedEntry, instrumented, "utf8");

const report = { schema_version: 1, entry: path.basename(entry), edition: isPro ? "pro" : "lite", required, initial: null, updated: null, passed: false };
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1688, height: 696 } });
const page = await context.newPage();
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(String(error)));

async function snapshot() {
  return page.evaluate(() => ({
    boardTitle: document.getElementById("boardTitleView")?.textContent?.trim() || "",
    noteText: [...document.querySelectorAll(".item-copy")].map((node) => node.textContent?.trim() || ""),
    hasOnDataUpdated: !!(globalThis.icueEvents && typeof globalThis.icueEvents.onDataUpdated === "function"),
    bridge: globalThis.__ratpackIcueBindingBridge || null,
  }));
}

let exitCode = 0;
try {
  await page.goto(pathToFileURL(instrumentedEntry).href, { waitUntil: "load", timeout: 30_000 });
  await page.waitForTimeout(400);
  report.initial = await snapshot();
  if (!report.initial.hasOnDataUpdated) throw new Error("Desk Notes does not expose icueEvents.onDataUpdated");
  if (report.initial.boardTitle !== beforeTitle) throw new Error(`initial board title mismatch: ${report.initial.boardTitle}`);
  if (!report.initial.noteText.includes("Before settings update")) throw new Error(`initial note was not rendered: ${JSON.stringify(report.initial.noteText)}`);

  await page.evaluate(() => {
    globalThis.__setDeskNotesSettingsSmoke();
    globalThis.icueEvents.onDataUpdated();
  });
  await page.waitForTimeout(400);
  report.updated = await snapshot();
  if (report.updated.boardTitle !== afterTitle) throw new Error(`updated board title mismatch: ${report.updated.boardTitle}`);
  if (!report.updated.noteText.includes("Settings path works")) throw new Error(`updated note was not rendered: ${JSON.stringify(report.updated.noteText)}`);
  if (!report.updated.bridge || Number(report.updated.bridge.version) < 2) throw new Error("Desk Notes is not using hardened iCUE binding bridge");
  if (pageErrors.length) throw new Error(`page errors: ${JSON.stringify(pageErrors)}`);
  await page.screenshot({ path: path.join(outDir, `desk-notes-${isPro ? "pro" : "lite"}-settings-updated.png`) });
  report.passed = true;
} catch (error) {
  report.error = String(error?.stack || error);
  exitCode = 1;
} finally {
  report.pageErrors = pageErrors;
  fs.writeFileSync(path.join(outDir, "desk-notes-settings-result.json"), JSON.stringify(report, null, 2) + "\n");
  try { fs.unlinkSync(instrumentedEntry); } catch {}
  await browser.close();
}

console.log(JSON.stringify(report, null, 2));
process.exit(exitCode);
