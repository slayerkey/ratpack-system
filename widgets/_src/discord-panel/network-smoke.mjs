import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

const entry = path.resolve(process.argv[2] || "widgets/discord-panel/index.html");
const artifactDir = path.resolve(process.argv[3] || "artifacts/discord-panel-network");
const companionBridgePath = process.argv[4] ? path.resolve(process.argv[4]) : null;
await fs.mkdir(artifactDir, { recursive: true });
assert.ok(companionBridgePath, "actual companion LocalBridgeServer path is required");
await fs.access(companionBridgePath);
const { LocalBridgeServer } = await import(pathToFileURL(companionBridgePath).href);
assert.equal(typeof LocalBridgeServer, "function", "companion LocalBridgeServer export missing");

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
  ok: true,
  protocol: 3,
  buildVersion: "0.3.0.0-companion-integration-fixture",
  updatedAt: new Date().toISOString(),
  bridge: { port: 17483, listening: true, clients: 0 },
  discord: { connected: true, ready: true, authenticated: true, pipe: "fixture", rpcVersion: 1, handshake: "ready", lastHandshakeError: null },
  streamkit: { mode: "public_rpc", stage: "ready", tokenCached: true, lastError: null },
  account: user,
  channel: { id: "7001", guild_id: "7000", name: "Consults", type: 2, voice_states: [voiceState] },
  voice: { mute: false, deaf: false },
  speaking: { "2001": false },
  scopes: ["rpc.voice.read", "rpc", "rpc.voice.write"],
  error: null,
};

const commands = [];
const commandOrigins = [];
let refreshCount = 0;

function currentSnapshot() {
  return {
    ...snapshot,
    updatedAt: new Date().toISOString(),
    bridge: { ...snapshot.bridge, clients: bridge.clients.size },
  };
}

const bridge = new LocalBridgeServer({ port: 17483, snapshot: currentSnapshot });
bridge.on("command", (message, meta = {}) => {
  commands.push(message);
  commandOrigins.push(meta.origin || null);
  if (message.command === "refresh") {
    refreshCount += 1;
    bridge.broadcastSnapshot();
    return;
  }
  if (message.command === "mute") {
    snapshot = { ...snapshot, voice: { ...snapshot.voice, mute: Boolean(message.value) } };
    bridge.broadcastSnapshot();
    return;
  }
  if (message.command === "deafen") {
    snapshot = { ...snapshot, voice: { ...snapshot.voice, deaf: Boolean(message.value) } };
    bridge.broadcastSnapshot();
  }
});
await bridge.start();

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

  assert.equal(bridge.clients.size, 1, "widget did not connect to actual companion loopback bridge");
  assert.ok(commandOrigins.every((origin) => origin === null || origin === "null" || origin === "file://"), `actual companion rejected or rewrote file-widget WebSocket Origin: ${commandOrigins.join(", ")}`);
  assert.ok(commands.some((message) => message.command === "refresh"), "widget did not request companion refresh after connecting");

  let state = await page.evaluate(() => globalThis.__PACKRAT_DISCORD_TEST__.getState());
  assert.equal(state.channel?.name, "Consults", "actual companion snapshot channel did not render");
  assert.equal(state.members.length, 1, "actual companion snapshot roster did not render");
  assert.equal(await page.locator("#muteButton").isDisabled(), false, "mute should be enabled in live voice state");
  assert.equal(await page.locator("#deafenButton").isDisabled(), false, "deafen should be enabled in live voice state");

  await page.locator("#muteButton").click();
  await page.waitForFunction(() => document.getElementById("muteLabel")?.textContent === "Unmute");
  assert.ok(commands.some((message) => message.command === "mute" && message.value === true), "mute command did not cross actual companion transport");

  await page.locator("#deafenButton").click();
  await page.waitForFunction(() => document.getElementById("deafenLabel")?.textContent === "Undeafen");
  assert.ok(commands.some((message) => message.command === "deafen" && message.value === true), "deafen command did not cross actual companion transport");

  snapshot = { ...snapshot, speaking: { "2001": true } };
  bridge.broadcastSnapshot();
  await page.waitForFunction(() => document.querySelectorAll(".member-row.speaking").length === 1);

  snapshot = {
    ...snapshot,
    channel: { ...snapshot.channel, id: "7002", name: "Ranked Room" },
    speaking: { "2001": false },
  };
  bridge.broadcastSnapshot();
  await page.waitForFunction(() => document.getElementById("channelName")?.textContent === "Ranked Room");
  state = await page.evaluate(() => globalThis.__PACKRAT_DISCORD_TEST__.getState());
  assert.equal(state.channel?.name, "Ranked Room", "actual companion automatic channel switch did not render");

  const firstClient = [...bridge.clients][0];
  assert.ok(firstClient?.socket, "actual companion client socket unavailable for reconnect test");
  firstClient.socket.destroy();
  await page.waitForFunction(() => globalThis.__PACKRAT_DISCORD_TEST__.getState().state === "disconnected");
  await page.waitForFunction(() => globalThis.__PACKRAT_DISCORD_TEST__.getState().state === "voice", null, { timeout: 7000 });
  await page.waitForFunction(() => globalThis.__PACKRAT_DISCORD_TEST__.getState().channel?.name === "Ranked Room");
  assert.equal(bridge.clients.size, 1, "widget did not establish a replacement companion connection");
  assert.ok(refreshCount >= 2, "widget did not refresh through actual companion after reconnect");

  await page.screenshot({ path: path.join(artifactDir, "live-companion-loopback.png"), fullPage: false });
  assert.deepEqual(pageErrors, [], `page errors: ${pageErrors.join(" | ")}`);
  assert.deepEqual(consoleErrors, [], `console errors: ${consoleErrors.join(" | ")}`);

  await fs.writeFile(path.join(artifactDir, "results.json"), JSON.stringify({
    entry,
    companionBridgePath,
    companionBridgeModule: "LocalBridgeServer",
    activeClients: bridge.clients.size,
    refreshCount,
    commandOrigins,
    commands,
    finalState: await page.evaluate(() => globalThis.__PACKRAT_DISCORD_TEST__.getState()),
  }, null, 2));

  console.log("DISCORD PANEL COMPANION INTEGRATION QA PASS: official packaged file-origin widget connected through the actual PackRat LocalBridgeServer, rendered protocol-3 snapshots, sent mute/deafen commands, followed speaking/channel changes, and recovered from socket loss");
} finally {
  await context.close();
  await browser.close();
  await bridge.stop();
}
