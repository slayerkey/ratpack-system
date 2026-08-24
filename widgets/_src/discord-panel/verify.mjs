import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const repo = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(".");
const source = path.join(repo, "widgets", "_src", "discord-panel");
const files = [
  "discord-panel-ui.js",
  "discord-panel-rpc.js",
  "discord-panel.js",
];

for (const file of files) {
  const full = path.join(source, file);
  assert.equal(fs.existsSync(full), true, `missing ${file}`);
  const result = spawnSync(process.execPath, ["--check", full], { encoding: "utf8" });
  assert.equal(result.status, 0, `${file} syntax failed: ${result.stderr || result.stdout}`);
}

const html = fs.readFileSync(path.join(source, "index.html"), "utf8");
assert.equal(html.includes('content="discordServerId"'), false);
assert.equal(html.includes('content="discordVoiceChannelId"'), false);
assert.equal(html.includes('content="discordChannelLabel"'), false);
assert.match(html, /discord-panel-rpc\.js/);

const transport = fs.readFileSync(path.join(source, "discord-panel-rpc.js"), "utf8");
assert.match(transport, /ws:\/\/127\.0\.0\.1:17483/);
assert.match(transport, /command: model\.state === "authorization" \? "authorize" : "refresh"/);
assert.match(transport, /command: field === "mute" \? "mute" : "deafen"/);
assert.match(transport, /value: Boolean\(nextValue\)/);
assert.match(transport, /Join any Discord voice channel and the panel will follow automatically/);
assert.equal(transport.includes("configure-streamkit"), false);
assert.equal(transport.includes("discord.com/api/oauth2"), false);
assert.equal(transport.includes("rpc.voice.read"), false);
assert.equal(transport.includes("rpc.voice.write"), false);
assert.equal(transport.includes("6463"), false);

console.log("DISCORD PANEL DEV QA PASS: source syntax, automatic loopback bridge transport, mute/deafen command mapping, no fixed channel configuration, and no direct Discord OAuth/RPC dependency");
