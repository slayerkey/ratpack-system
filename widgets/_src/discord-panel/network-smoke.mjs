import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { WebSocketServer } from "ws";

const entry = path.resolve(process.argv[2] || "widgets/discord-panel/index.html");
const artifactDir = path.resolve(process.argv[3] || "artifacts/discord-panel-network");
await fs.mkdir(artifactDir, { recursive: true });

const user = {
  id: "2001",
  username: "fixture-owner",
  discriminator: "0",
  global_name: "Fixture Owner",
  avatar: null,
};

const voiceState = {
  nick: "Fixture Owner",
  mute: false,
  volume: 100,
  pan: { left: 1, right: 1 },
  voice_state: { mute: false, deaf: false, self_mute: false, self_deaf: false, suppress: false },
  user: { ...user, bot: false, flags: 0, premium_type: 0 },
};

let snapshot = {
  type: "snapshot",
  ok: true,
  protocol: 3,
  buildVersion: "0.3.0.0-fixture",
  bridge: { port: 17483, listening: true, clients: 1 },
  discord: { connected: true, ready: true, authenticated: true, pipe: "fixture", rpcVersion: 1, handshake: "ready", lastHandshakeError: null },
  streamkit: { mode: "public_rpc", stage: "ready", clientId: "207646673902501888", tokenCached: true, lastError: null },
  account: user,
  channel: { id: "7001", guild_id: "7000", name: "Consults", type: 2, voice_states: [voiceState] },
  voice: { mute: false, deaf: false },
  speaking: { "2001": false },
  scopes: ["rpc.voice.read", "rpc", "rpc.voice.write"],
  error: null,
};

const commands = [];
const origins = [];
const sockets = new Set();
let connectionCount = 0;

const wss = new WebSocketServer({ host: "127.0.0.1", port: 17483 });
await new Promise((resolve, reject) => {
  wss.once("listening", resolve);
  wss.once("error", reject);
});

function broadcast(value = snapshot) {
  const text = JSON.stringify(value);
  for (const socket of sockets) {
    if (socket.readyState === socket.OPEN) socket.send(text);
  }
}

wss.on("connection", (socket, request) => {
  connectionCount += 1;
  origins.push(request.headers.origin || null);
  sockets.add(socket);
  socket.on("close", () => sockets.delete(socket));
  socket.on("message", (raw) => {
    let message;
    try { message = JSON.parse(String(raw)); } catch { return; }
    commands.push(message);
    if (message.command === "refresh") {
      socket.send(JSON.stringify(snapshot));
      return;
    }
    if (message.command === "mute") {
      snapshot = { ...snapshot, voice: { ...snapshot.voice, mute: Boolean(message.value) } };
      socket.send(JSON.stringify(snapshot));
      return;
    }
    if (message.command === "deafen") {
      snapshot = { ...snapshot, voice: { ...snapshot.voice, deaf: Boolean(message.value) } };
      socket.send(JSON.stringify(snapshot));
    }
  });
});

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 840, height: 696 } });
const page = await context.newPage();
const pageErrors = [];
const consoleErrors = [];
page.on("pageerror", (error) => pageErrors.push(String(error?.stack || error)));
page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});

try {
  await page.goto(pathToFileURL(entry).href, { waitUntil: "load" });
  await page.waitForFunction(() => Boolean(globalThis.__PACKRAT_DISCORD_TEST__));
  await page.waitForFunction(() => globalThis.__PACKRAT_DISCORD_TEST__.getState().state === "voice");
  await page.waitForTimeout(1200); // catches delayed timer/runtime faults

  assert.ok(connectionCount >= 1, "widget did not connect to loopback bridge");
  assert.ok(origins.every((origin) => origin === null || origin === "null" || origin === "file://"), `unexpected file-widget WebSocket Origin: ${origins.join(", ")}`);
  assert.ok(commands.some((message) => message.command === "refresh"), "widget did not request bridge refresh after connecting");

  let state = await page.evaluate(() => globalThis.__PACKRAT_DISCORD_TEST__.getState());
  assert.equal(state.channel?.name, "Consults", "live snapshot channel did not render");
  assert.equal(state.members.length, 1, "live snapshot roster did not render");
  assert.equal(await page.locator("#muteButton").isDisabled(), false, "mute should be enabled in live voice state");
  assert.equal(await page.locator("#deafenButton").isDisabled(), false, "deafen should be enabled in live voice state");

  await page.locator("#muteButton").click();
  await page.waitForFunction(() => document.getElementById("muteLabel")?.textContent === "Unmute");
  assert.ok(commands.some((message) => message.command === "mute" && message.value === true), "mute command did not cross loopback transport");

  await page.locator("#deafenButton").click();
  await page.waitForFunction(() => document.getElementById("deafenLabel")?.textContent === "Undeafen");
  assert.ok(commands.some((message) => message.command === "deafen" && message.value === true), "deafen command did not cross loopback transport");

  snapshot = { ...snapshot, speaking: { "2001": true } };
  broadcast();
  await page.waitForFunction(() => document.querySelectorAll(".member-row.speaking").length === 1);

  snapshot = {
    ...snapshot,
    channel: { ...snapshot.channel, id: "7002", name: "Ranked Room" },
    speaking: { "2001": false },
  };
  broadcast();
  await page.waitForFunction(() => document.getElementById("channelName")?.textContent === "Ranked Room");
  state = await page.evaluate(() => globalThis.__PACKRAT_DISCORD_TEST__.getState());
  assert.equal(state.channel?.name, "Ranked Room", "live automatic channel switch did not render");

  const firstSocket = [...sockets][0];
  firstSocket.close();
  await page.waitForFunction(() => globalThis.__PACKRAT_DISCORD_TEST__.getState().state === "disconnected");
  await page.waitForFunction(() => globalThis.__PACKRAT_DISCORD_TEST__.getState().state === "voice", null, { timeout: 7000 });
  assert.ok(connectionCount >= 2, "widget did not reconnect after loopback socket closed");
  assert.ok(commands.filter((message) => message.command === "refresh").length >= 2, "widget did not refresh after reconnect");

  await page.screenshot({ path: path.join(artifactDir, "live-loopback.png"), fullPage: false });
  assert.deepEqual(pageErrors, [], `page errors: ${pageErrors.join(" | ")}`);
  assert.deepEqual(consoleErrors, [], `console errors: ${consoleErrors.join(" | ")}`);

  await fs.writeFile(path.join(artifactDir, "results.json"), JSON.stringify({
    entry,
    connectionCount,
    origins,
    commands,
    finalState: await page.evaluate(() => globalThis.__PACKRAT_DISCORD_TEST__.getState()),
  }, null, 2));

  console.log("DISCORD PANEL NETWORK QA PASS: packaged file-origin widget connected to loopback WebSocket, rendered real-shape snapshots, sent mute/deafen commands, followed speaking/channel changes, and recovered from socket loss");
} finally {
  await context.close();
  await browser.close();
  for (const socket of sockets) socket.terminate();
  await new Promise((resolve) => wss.close(resolve));
}
