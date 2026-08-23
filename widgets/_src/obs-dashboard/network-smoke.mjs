import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { WebSocketServer } from "ws";

const entry = process.argv[2];
const outDir = process.argv[3] || "artifacts/network-smoke";
if (!entry || !fs.existsSync(entry)) {
  console.error("usage: node network-smoke.mjs <packaged-index.html> [output-dir]");
  process.exit(2);
}
fs.mkdirSync(outDir, { recursive: true });

const password = "ratpack-network-smoke";
const salt = "RatPackSalt2026";
const challenge = "RatPackChallengeOBS";
const sha256b64 = (value) => crypto.createHash("sha256").update(value, "utf8").digest("base64");
const secret = sha256b64(password + salt);
const expectedAuthentication = sha256b64(secret + challenge);

const report = {
  schema_version: 1,
  entry: path.basename(entry),
  transport: "ws://127.0.0.1:4455",
  origin: null,
  connected: false,
  authenticated: false,
  identified: false,
  requests: [],
  sceneSwitch: false,
  firstStreamTapSentControl: false,
  secondStreamTapSentControl: false,
  runtimeErrors: [],
};

let currentScene = "Gameplay";
let streamActive = true;
const startedAt = Date.now();
const baseBytes = 1_512_000_000;

function response(ws, request, responseData = {}) {
  ws.send(JSON.stringify({
    op: 7,
    d: {
      requestType: request.requestType,
      requestId: request.requestId,
      requestStatus: { result: true, code: 100 },
      responseData,
    },
  }));
}

function event(ws, eventType, eventIntent, eventData) {
  ws.send(JSON.stringify({ op: 5, d: { eventType, eventIntent, eventData } }));
}

const wss = new WebSocketServer({ host: "127.0.0.1", port: 4455 });
wss.on("connection", (ws, request) => {
  report.connected = true;
  report.origin = request.headers.origin ?? null;
  ws.send(JSON.stringify({
    op: 0,
    d: {
      obsWebSocketVersion: "5.7.4",
      rpcVersion: 1,
      authentication: { challenge, salt },
    },
  }));

  ws.on("message", (raw) => {
    const message = JSON.parse(String(raw));
    if (message.op === 1) {
      report.authenticated = message.d?.authentication === expectedAuthentication;
      if (!report.authenticated) {
        ws.close(4009, "Authentication failed");
        return;
      }
      report.identified = true;
      ws.send(JSON.stringify({ op: 2, d: { negotiatedRpcVersion: 1 } }));
      return;
    }
    if (message.op !== 6) return;

    const requestData = message.d || {};
    report.requests.push({
      type: requestData.requestType,
      data: requestData.requestData || null,
      at: Date.now(),
    });

    switch (requestData.requestType) {
      case "GetStreamStatus": {
        const elapsed = Math.max(0, Date.now() - startedAt);
        response(ws, requestData, {
          outputActive: streamActive,
          outputReconnecting: false,
          outputTimecode: streamActive ? "00:42:18" : "00:00:00",
          outputDuration: streamActive ? 2_538_000 : 0,
          outputBytes: baseBytes + Math.round(elapsed * 750),
          outputSkippedFrames: 23,
          outputTotalFrames: 151_860,
          outputCongestion: 0.01,
        });
        break;
      }
      case "GetRecordStatus":
        response(ws, requestData, {
          outputActive: true,
          outputPaused: false,
          outputTimecode: "00:18:42",
          outputDuration: 1_122_000,
          outputBytes: 887_000_000,
        });
        break;
      case "GetStats":
        response(ws, requestData, {
          availableDiskSpace: 481_920,
          outputSkippedFrames: 17,
          outputTotalFrames: 151_854,
          renderSkippedFrames: 3,
          renderTotalFrames: 151_900,
        });
        break;
      case "GetSceneList":
        response(ws, requestData, {
          currentProgramSceneName: currentScene,
          scenes: [
            { sceneName: "Gameplay", sceneIndex: 0 },
            { sceneName: "Just Chatting", sceneIndex: 1 },
            { sceneName: "Starting Soon", sceneIndex: 2 },
            { sceneName: "BRB", sceneIndex: 3 },
            { sceneName: "Ending", sceneIndex: 4 },
          ],
        });
        break;
      case "GetCurrentProgramScene":
        response(ws, requestData, { sceneName: currentScene, currentProgramSceneName: currentScene });
        break;
      case "SetCurrentProgramScene":
        currentScene = String(requestData.requestData?.sceneName || currentScene);
        report.sceneSwitch = currentScene === "BRB";
        response(ws, requestData, {});
        event(ws, "CurrentProgramSceneChanged", 4, { sceneName: currentScene });
        break;
      case "StopStream":
        streamActive = false;
        response(ws, requestData, {});
        event(ws, "StreamStateChanged", 64, {
          outputActive: false,
          outputState: "OBS_WEBSOCKET_OUTPUT_STOPPED",
        });
        break;
      case "StartStream":
        streamActive = true;
        response(ws, requestData, {});
        event(ws, "StreamStateChanged", 64, {
          outputActive: true,
          outputState: "OBS_WEBSOCKET_OUTPUT_STARTED",
        });
        break;
      default:
        response(ws, requestData, {});
    }
  });
});

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1688, height: 696 } });
await context.addInitScript(({ password }) => {
  globalThis.uniqueId = "network-smoke";
  globalThis.obsPort = "4455";
  globalThis.obsPassword = password;
  globalThis.textColor = "#F2F5F7";
  globalThis.accentColor = "#2BE86A";
  globalThis.backgroundColor = "#0B0E11";
  globalThis.tr = async (value) => value;
}, { password });
const page = await context.newPage();
page.on("pageerror", (error) => report.runtimeErrors.push(String(error)));
page.on("console", (message) => {
  if (message.type() === "error") report.runtimeErrors.push(message.text());
});

let exitCode = 0;
try {
  await page.goto(pathToFileURL(path.resolve(entry)).href, { waitUntil: "load", timeout: 30_000 });
  await page.waitForFunction(() => document.body?.getAttribute("data-connection") === "connected", { timeout: 10_000 });
  await page.waitForFunction(() => Number(document.getElementById("bitrateValue")?.textContent || 0) > 0, { timeout: 6_000 });
  await page.waitForFunction(() => document.getElementById("activeScene")?.textContent === "Gameplay", { timeout: 5_000 });

  if (!report.connected || !report.authenticated || !report.identified) {
    throw new Error(`OBS handshake incomplete: ${JSON.stringify(report)}`);
  }

  const requiredRequests = ["GetStreamStatus", "GetRecordStatus", "GetStats", "GetSceneList"];
  for (const type of requiredRequests) {
    if (!report.requests.some((item) => item.type === type)) throw new Error(`missing request ${type}`);
  }

  await page.locator('.scene-button[data-scene-name="BRB"]').click();
  await page.waitForFunction(() => document.getElementById("activeScene")?.textContent === "BRB", { timeout: 5_000 });
  if (!report.sceneSwitch) throw new Error("network scene switch did not reach mock OBS");

  const stopCountBefore = report.requests.filter((item) => item.type === "StopStream").length;
  await page.locator("#streamControl").click();
  await page.waitForFunction(() => document.getElementById("stateText")?.textContent === "STOP STREAM?", { timeout: 2_000 });
  const stopCountAfterFirst = report.requests.filter((item) => item.type === "StopStream").length;
  report.firstStreamTapSentControl = stopCountAfterFirst > stopCountBefore;
  if (report.firstStreamTapSentControl) throw new Error("first stream tap sent StopStream before confirmation");

  await page.locator("#streamControl").click();
  await page.waitForFunction(() => document.body?.getAttribute("data-stream") === "standby", { timeout: 5_000 });
  const stopCountAfterSecond = report.requests.filter((item) => item.type === "StopStream").length;
  report.secondStreamTapSentControl = stopCountAfterSecond > stopCountAfterFirst;
  if (!report.secondStreamTapSentControl) throw new Error("second stream tap did not send StopStream");

  if (report.runtimeErrors.length) throw new Error(`runtime errors: ${JSON.stringify(report.runtimeErrors)}`);

  await page.screenshot({ path: path.join(outDir, "network-smoke.png") });
} catch (error) {
  report.error = String(error?.stack || error);
  exitCode = 1;
} finally {
  report.finalScene = currentScene;
  report.finalStreamActive = streamActive;
  report.requestTypes = report.requests.map((item) => item.type);
  fs.writeFileSync(path.join(outDir, "network-smoke-result.json"), JSON.stringify(report, null, 2) + "\n");
  await browser.close();
  await new Promise((resolve) => wss.close(resolve));
}

console.log(JSON.stringify(report, null, 2));
process.exit(exitCode);
