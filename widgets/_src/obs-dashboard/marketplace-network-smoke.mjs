#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { WebSocketServer } from "ws";

const entry = process.argv[2];
const outDir = process.argv[3] || "artifacts/marketplace-network-smoke";
if (!entry || !fs.existsSync(entry)) {
  console.error("usage: node marketplace-network-smoke.mjs <packaged-index.html> [output-dir]");
  process.exit(2);
}
fs.mkdirSync(outDir, { recursive: true });

const PORT = 4460;
const GOOD_PASSWORD = "ratpack-obs-test";
const report = { schema_version: 2, port: PORT, phases: [], connections: 0, passed: false };
let server = null;
let serverClients = new Set();

function sha256Base64(value) {
  return crypto.createHash("sha256").update(value).digest("base64");
}

async function startServer({ auth }) {
  const salt = "ratpack-marketplace-salt";
  const challenge = "ratpack-marketplace-challenge";
  const expected = sha256Base64(sha256Base64(GOOD_PASSWORD + salt) + challenge);
  const wss = new WebSocketServer({ host: "127.0.0.1", port: PORT });
  server = wss;
  wss.on("connection", (socket) => {
    serverClients.add(socket);
    report.connections += 1;
    socket.on("close", () => serverClients.delete(socket));
    socket.send(JSON.stringify({
      op: 0,
      d: {
        obsWebSocketVersion: "5.5.2",
        rpcVersion: 1,
        ...(auth ? { authentication: { challenge, salt } } : {})
      }
    }));
    socket.on("message", (buffer) => {
      let message;
      try { message = JSON.parse(String(buffer)); } catch { return; }
      if (message.op === 1) {
        if (auth && message.d?.authentication !== expected) {
          socket.close(4009, "Authentication Failed");
          return;
        }
        socket.send(JSON.stringify({ op: 2, d: { negotiatedRpcVersion: 1 } }));
        return;
      }
      if (message.op !== 6) return;
      const requestType = message.d?.requestType || "";
      const requestId = message.d?.requestId || "";
      let responseData = {};
      if (requestType === "GetVersion") responseData = { obsVersion: "32.0.0", obsWebSocketVersion: "5.5.2" };
      else if (requestType === "GetStreamStatus") responseData = { outputActive: false, outputReconnecting: false, outputDuration: 0, outputTimecode: "00:00:00", outputBytes: 0, outputSkippedFrames: 0, outputTotalFrames: 0, outputCongestion: 0 };
      else if (requestType === "GetRecordStatus") responseData = { outputActive: false, outputPaused: false, outputDuration: 0, outputTimecode: "00:00:00", outputBytes: 0 };
      else if (requestType === "GetStats") responseData = { availableDiskSpace: 102400, outputSkippedFrames: 0, outputTotalFrames: 1000, renderSkippedFrames: 0, renderTotalFrames: 1000 };
      else if (requestType === "GetSceneList") responseData = { currentProgramSceneName: "Scene A", scenes: [{ sceneName: "Scene A", sceneIndex: 0 }, { sceneName: "Scene B", sceneIndex: 1 }] };
      socket.send(JSON.stringify({ op: 7, d: { requestType, requestId, requestStatus: { result: true, code: 100 }, responseData } }));
    });
  });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("OBS mock server start timeout")), 5000);
    wss.once("listening", () => { clearTimeout(timeout); resolve(); });
    wss.once("error", reject);
  });
}

async function stopServer() {
  const current = server;
  server = null;
  if (!current) return;
  for (const client of [...serverClients]) {
    try { client.terminate(); } catch {}
  }
  serverClients.clear();
  await new Promise((resolve) => current.close(() => resolve()));
}

const packagedHtml = fs.readFileSync(entry, "utf8");
const harness = `<script id="ratpack-obs-marketplace-harness">
let obsPort = "${PORT}";
let obsPassword = "";
let textColor = "#F2F5F7";
let accentColor = "#2BE86A";
let backgroundColor = "#0B0E11";
let iCUE_initialized = true;
let uniqueId = "ratpack-obs-marketplace-smoke";
globalThis.tr = async function (value) { return value; };
globalThis.__setRatpackObsSettings = function (port, password) {
  obsPort = String(port);
  obsPassword = String(password);
};
</script>`;
if (!/<head(?:\s[^>]*)?>/i.test(packagedHtml)) throw new Error("packaged OBS widget is missing <head>");
const instrumentedHtml = packagedHtml.replace(/<head(\s[^>]*)?>/i, (match) => match + "\n" + harness);
const instrumentedEntry = path.join(path.dirname(path.resolve(entry)), "__ratpack-obs-marketplace-instrumented.html");
fs.writeFileSync(instrumentedEntry, instrumentedHtml, "utf8");
report.instrumentedEntry = path.basename(instrumentedEntry);

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1688, height: 696 } });
const page = await context.newPage();
const runtimeErrors = [];
page.on("pageerror", (error) => runtimeErrors.push(String(error)));

async function state() {
  return page.evaluate(() => ({
    connection: document.body?.getAttribute("data-connection") || "",
    badge: document.getElementById("connectionBadge")?.textContent || "",
    title: document.getElementById("offlineTitle")?.textContent || "",
    port: globalThis.obsPort,
    password: globalThis.obsPassword,
  }));
}

async function waitConnection(expected, timeout = 10_000) {
  await page.waitForFunction((wanted) => document.body?.getAttribute("data-connection") === wanted, expected, { timeout });
}

async function setSettings(port, password) {
  await page.evaluate(({ port, password }) => {
    if (typeof globalThis.__setRatpackObsSettings !== "function") throw new Error("OBS marketplace harness setter missing");
    globalThis.__setRatpackObsSettings(port, password);
    if (globalThis.icueEvents && typeof globalThis.icueEvents.onDataUpdated === "function") globalThis.icueEvents.onDataUpdated();
  }, { port, password });
}

let exitCode = 0;
try {
  // OBS closed / starts after the widget.
  await page.goto(pathToFileURL(instrumentedEntry).href, { waitUntil: "load", timeout: 30_000 });
  await page.waitForTimeout(1200);
  const bridge = await page.evaluate(() => globalThis.__ratpackIcueBindingBridge || null);
  if (!bridge || !bridge.names?.includes("obsPort") || !bridge.names?.includes("obsPassword")) throw new Error("packaged OBS widget is missing live port/password binding bridge");
  const closed = await state();
  if (String(closed.port) !== String(PORT)) throw new Error(`OBS port lexical binding mismatch: ${closed.port} != ${PORT}`);
  report.phases.push({ phase: "obs-closed", state: closed });

  await startServer({ auth: false });
  await waitConnection("connected", 12_000);
  report.phases.push({ phase: "auth-disabled-connect-after-start", state: await state() });

  // OBS restarts while widget remains open.
  await stopServer();
  await page.waitForFunction(() => document.body?.getAttribute("data-connection") !== "connected", { timeout: 7000 });
  report.phases.push({ phase: "obs-restart-down", state: await state() });
  await startServer({ auth: false });
  await waitConnection("connected", 12_000);
  report.phases.push({ phase: "obs-restart-reconnected", state: await state() });

  // Authentication enabled with wrong password, then correct without reloading.
  await stopServer();
  await startServer({ auth: true });
  await page.waitForFunction(() => document.body?.getAttribute("data-connection") === "auth", { timeout: 12_000 });
  report.phases.push({ phase: "wrong-password", state: await state() });
  await setSettings(PORT, GOOD_PASSWORD);
  await waitConnection("connected", 10_000);
  report.phases.push({ phase: "correct-password-after-failure", state: await state() });

  // Wrong port, then correct configuration again.
  await setSettings(PORT + 1, GOOD_PASSWORD);
  await page.waitForFunction(() => document.body?.getAttribute("data-connection") !== "connected", { timeout: 7000 });
  report.phases.push({ phase: "wrong-port", state: await state() });
  await setSettings(PORT, GOOD_PASSWORD);
  await waitConnection("connected", 10_000);
  report.phases.push({ phase: "correct-port-after-failure", state: await state() });

  const names = report.phases.map((item) => item.phase);
  const required = ["obs-closed", "auth-disabled-connect-after-start", "obs-restart-reconnected", "wrong-password", "correct-password-after-failure", "wrong-port", "correct-port-after-failure"];
  for (const phase of required) if (!names.includes(phase)) throw new Error(`missing OBS marketplace test phase: ${phase}`);
  if (report.phases.find((item) => item.phase === "wrong-password")?.state.connection !== "auth") throw new Error("wrong password did not render auth failure");
  if (report.phases.find((item) => item.phase === "correct-port-after-failure")?.state.connection !== "connected") throw new Error("OBS did not reconnect after corrected settings");
  if (report.connections < 4) throw new Error(`expected repeated real loopback connections, saw ${report.connections}`);

  await page.screenshot({ path: path.join(outDir, "obs-connected.png") });
  report.passed = true;
} catch (error) {
  report.error = String(error?.stack || error);
  exitCode = 1;
} finally {
  report.runtimeErrors = runtimeErrors;
  await stopServer();
  await browser.close();
  try { fs.unlinkSync(instrumentedEntry); } catch {}
  fs.writeFileSync(path.join(outDir, "marketplace-network-result.json"), JSON.stringify(report, null, 2) + "\n");
}

console.log(JSON.stringify(report, null, 2));
process.exit(exitCode);
