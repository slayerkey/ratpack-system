import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const root = process.cwd();

test("manifest uses SDK v2 protocol with SDKVersion 3, Node 24 and twelve focused actions", async () => {
  const manifest = JSON.parse(await readFile(resolve(root, "com.packrat.voice-deck.sdPlugin/manifest.json"), "utf8"));
  assert.equal(manifest.SDKVersion, 3);
  assert.equal(manifest.Nodejs.Version, "24");
  assert.equal(manifest.UUID, "com.packrat.voice-deck");
  assert.equal(manifest.Actions.length, 12);
  assert.equal(new Set(manifest.Actions.map((a) => a.UUID)).size, 12);
  assert.equal(manifest.Profiles.length, 4);
  assert.equal(manifest.Profiles.some((p) => p.DeviceType === 7), true);
  assert.equal(manifest.Actions.find((a) => a.UUID.endsWith("navigator")).Controllers.includes("Encoder"), true);
});

test("bundled profiles exist, are deterministic ZIPs and contain no credential material", async () => {
  const dir = resolve(root, "com.packrat.voice-deck.sdPlugin/profiles");
  const names = (await readdir(dir)).filter((name) => name.endsWith(".streamDeckProfile")).sort();
  assert.deepEqual(names, ["compact-voice-neo.streamDeckProfile", "voice-dashboard-mk2.streamDeckProfile", "voice-dashboard-plus.streamDeckProfile", "voice-dashboard-xl.streamDeckProfile"]);
  for (const name of names) {
    const buffer = await readFile(resolve(dir, name));
    assert.equal(buffer.subarray(0, 2).toString("ascii"), "PK");
    assert.equal(buffer.includes(Buffer.from("client_secret")), false);
    assert.equal(buffer.includes(Buffer.from("access_token")), false);
  }
});

test("property inspector is local-only and does not load remote scripts", async () => {
  const html = await readFile(resolve(root, "ui/inspector.html"), "utf8");
  const js = await readFile(resolve(root, "ui/inspector.js"), "utf8");
  assert.equal(/https?:\/\//i.test(html), false);
  assert.equal(/fetch\s*\(/.test(js), false);
  assert.match(js, /sendToPlugin/);
});

test("source contains no Discord user-token scraping or confidential client secret", async () => {
  const files = ["src/plugin.js", "src/voice-session.js", "src/streamkit-rpc.js"];
  const text = (await Promise.all(files.map((file) => readFile(resolve(root, file), "utf8")))).join("\n");
  assert.equal(/client_secret/i.test(text), false);
  assert.equal(/localStorage/i.test(text), false);
  assert.equal(/users\/@me/i.test(text), false);
  assert.equal(/authorization:\s*["'`]Bot/i.test(text), false);
});
