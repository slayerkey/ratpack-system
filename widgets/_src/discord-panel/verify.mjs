import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const repo = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(".");
const source = path.join(repo, "widgets", "_src", "discord-panel");
const files = [
  "discord-panel-ui.js",
  "discord-panel-rpc.js",
  "discord-panel-streamkit-patch.js",
  "discord-panel.js",
];

for (const file of files) {
  const full = path.join(source, file);
  assert.equal(fs.existsSync(full), true, `missing ${file}`);
  const result = spawnSync(process.execPath, ["--check", full], { encoding: "utf8" });
  assert.equal(result.status, 0, `${file} syntax failed: ${result.stderr || result.stdout}`);
}

const html = fs.readFileSync(path.join(source, "index.html"), "utf8");
assert.match(html, /content="discordServerId"/);
assert.match(html, /content="discordVoiceChannelId"/);
assert.match(html, /content="discordChannelLabel"/);
assert.match(html, /discord-panel-streamkit-patch\.js/);

const transport = fs.readFileSync(path.join(source, "discord-panel-rpc.js"), "utf8");
assert.match(transport, /ws:\/\/127\.0\.0\.1:17483/);
assert.match(transport, /configure-streamkit/);
assert.match(transport, /toggle-mute|command: "mute"/);
assert.equal(transport.includes("discord.com/api/oauth2"), false);
assert.equal(transport.includes("rpc.voice.read"), false);
assert.equal(transport.includes("rpc.voice.write"), false);
assert.equal(transport.includes("6463"), false);

console.log("DISCORD PANEL DEV QA PASS: source syntax, iCUE channel settings, local bridge transport, and no direct Discord OAuth/RPC dependency");
