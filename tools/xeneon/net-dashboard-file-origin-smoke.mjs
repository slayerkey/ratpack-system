#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

const entry = process.argv[2];
const outDir = process.argv[3] || "artifacts/net-file-origin";
if (!entry || !fs.existsSync(entry)) {
  console.error("usage: node net-dashboard-file-origin-smoke.mjs <packaged-index.html> [output-dir]");
  process.exit(2);
}
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1688, height: 696 } });
const page = await context.newPage();
const report = { schema_version: 1, entry: path.basename(entry), passed: false };
let exitCode = 0;
try {
  await page.addInitScript(() => {
    globalThis.uniqueId = "net-file-origin";
    globalThis.probeHosts = "https://example.test/health";
    globalThis.probeInterval = 5;
    globalThis.warnAt = 100;
    globalThis.textColor = "#F4F6F8";
    globalThis.accentColor = "#2BE86A";
    globalThis.backgroundColor = "#07090D";
    globalThis.tr = async (value) => value;
    globalThis.__netFetchCalls = [];
    globalThis.fetch = async (url, options = {}) => {
      globalThis.__netFetchCalls.push({ url: String(url), mode: options.mode || "", method: options.method || "GET" });
      await new Promise((resolve) => setTimeout(resolve, 32));
      return {
        type: "opaque",
        status: 0,
        ok: false,
        body: { cancel() {} },
      };
    };
  });

  await page.goto(pathToFileURL(path.resolve(entry)).href, { waitUntil: "load", timeout: 30_000 });
  await page.waitForFunction(() => {
    const value = document.getElementById("pingValue")?.textContent?.trim();
    return value && value !== "--";
  }, null, { timeout: 6000 });

  report.result = await page.evaluate(() => ({
    origin: location.protocol,
    ping: document.getElementById("pingValue")?.textContent?.trim() || "",
    foot: document.getElementById("pingFoot")?.textContent?.trim() || "",
    state: document.body.getAttribute("data-state"),
    transport: globalThis.__packratNetTransport || null,
    calls: globalThis.__netFetchCalls || [],
  }));

  if (report.result.origin !== "file:") throw new Error(`expected file origin, got ${report.result.origin}`);
  if (!report.result.transport || report.result.transport.mode !== "opaque-https-timing") throw new Error("file-origin transport patch missing");
  if (!report.result.calls.length) throw new Error("probe did not issue an HTTPS request");
  if (report.result.calls[0].mode !== "no-cors") throw new Error(`probe still requires CORS: ${JSON.stringify(report.result.calls[0])}`);
  if (!Number.isFinite(Number(report.result.ping))) throw new Error(`ping metric was not measured: ${JSON.stringify(report.result)}`);
  if (report.result.state !== "live") throw new Error(`network did not reach live state: ${JSON.stringify(report.result)}`);
  await page.screenshot({ path: path.join(outDir, "net-file-origin-live.png") });
  report.passed = true;
} catch (error) {
  report.error = String(error?.stack || error);
  exitCode = 1;
} finally {
  fs.writeFileSync(path.join(outDir, "net-file-origin-result.json"), JSON.stringify(report, null, 2) + "\n");
  await browser.close();
}
console.log(JSON.stringify(report, null, 2));
process.exit(exitCode);
