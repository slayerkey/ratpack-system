import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

const entry = path.resolve(process.argv[2] || "widgets/_src/discord-panel/index.html");
const artifactDir = path.resolve(process.argv[3] || "artifacts/discord-panel-visual");
await fs.mkdir(artifactDir, { recursive: true });

const slots = [
  { id: "s-h", width: 840, height: 344, minTouch: 72 },
  { id: "s-v", width: 696, height: 416, minTouch: 72 },
  { id: "m-h", width: 840, height: 696, minTouch: 88 },
  { id: "m-v", width: 696, height: 840, minTouch: 88 },
  { id: "l-h", width: 1688, height: 696, minTouch: 98 },
  { id: "l-v", width: 696, height: 1688, minTouch: 102 },
  { id: "xl-h", width: 2536, height: 696, minTouch: 104 },
  { id: "xl-v", width: 696, height: 2536, minTouch: 106 },
];

function member(index, overrides = {}) {
  const id = String(1000 + index);
  const state = overrides.voice_state || {};
  return {
    nick: overrides.nick || (index === 11 ? "A Very Long Discord Display Name For Layout Stress" : `Member ${index}`),
    mute: false,
    volume: 100,
    pan: { left: 1, right: 1 },
    voice_state: {
      mute: false,
      deaf: false,
      self_mute: false,
      self_deaf: false,
      suppress: false,
      ...state,
    },
    user: {
      id,
      username: `member${index}`,
      discriminator: "0",
      global_name: null,
      avatar: null,
      avatar_url: index === 1 ? "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32'%3E%3Crect width='32' height='32' fill='%235865F2'/%3E%3C/svg%3E" : undefined,
      bot: false,
      flags: 0,
      premium_type: 0,
    },
  };
}

const members = Array.from({ length: 12 }, (_, i) => member(i + 1));
members[3].voice_state.self_mute = true;
members[4].voice_state.self_deaf = true;
members[4].voice_state.self_mute = true;

const fixture = {
  user: { id: "1001", username: "fixture-owner", global_name: "Fixture Owner" },
  voice: { mute: false, deaf: false },
  channel: {
    id: "555000000000000001",
    guild_id: "555000000000000000",
    name: "Consults",
    type: 2,
    voice_states: members,
  },
  speaking: ["1002", "1006"],
  activity: [],
};

function liveSnapshot(overrides = {}) {
  return {
    type: "snapshot",
    ok: true,
    protocol: 3,
    buildVersion: "0.3.0.0-fixture",
    bridge: { port: 17483, listening: true, clients: 1 },
    discord: { connected: true, ready: true, authenticated: true, handshake: "ready" },
    streamkit: { mode: "public_rpc", stage: "ready", tokenCached: true },
    account: fixture.user,
    channel: fixture.channel,
    voice: { mute: false, deaf: false },
    speaking: { "1002": true, "1006": true },
    scopes: ["rpc", "rpc.voice.read", "rpc.voice.write"],
    error: null,
    ...overrides,
  };
}

const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const slot of slots) {
    const context = await browser.newContext({ viewport: { width: slot.width, height: slot.height } });
    await context.addInitScript((value) => {
      globalThis.__PACKRAT_DISCORD_FIXTURE__ = value;
      globalThis.icueEvents = function () {};
    }, fixture);
    const page = await context.newPage();
    const pageErrors = [];
    const consoleErrors = [];
    page.on("pageerror", (error) => pageErrors.push(String(error?.stack || error)));
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });

    await page.goto(pathToFileURL(entry).href, { waitUntil: "load" });
    await page.waitForFunction(() => Boolean(globalThis.__PACKRAT_DISCORD_TEST__));
    await page.waitForTimeout(1250); // catches delayed runtime/timer regressions

    const state = await page.evaluate(() => globalThis.__PACKRAT_DISCORD_TEST__.getState());
    assert.equal(state.state, "voice", `${slot.id}: expected voice state`);
    assert.equal(state.channel?.name, "Consults", `${slot.id}: wrong channel`);
    assert.equal(state.members.length, 12, `${slot.id}: roster count`);
    assert.equal(state.slot, slot.id, `${slot.id}: nearest-slot detection`);

    const layout = await page.evaluate(() => {
      const doc = document.documentElement;
      const body = document.body;
      const rect = (id) => {
        const r = document.getElementById(id).getBoundingClientRect();
        return { width: r.width, height: r.height, top: r.top, left: r.left, right: r.right, bottom: r.bottom };
      };
      return {
        innerWidth,
        innerHeight,
        docScrollWidth: doc.scrollWidth,
        docScrollHeight: doc.scrollHeight,
        bodyScrollWidth: body.scrollWidth,
        bodyScrollHeight: body.scrollHeight,
        mute: rect("muteButton"),
        deafen: rect("deafenButton"),
        speakingRows: document.querySelectorAll(".member-row.speaking").length,
        rowCount: document.querySelectorAll(".member-row").length,
      };
    });

    assert.ok(layout.docScrollWidth <= slot.width + 1, `${slot.id}: document horizontal overflow ${layout.docScrollWidth}/${slot.width}`);
    assert.ok(layout.bodyScrollWidth <= slot.width + 1, `${slot.id}: body horizontal overflow ${layout.bodyScrollWidth}/${slot.width}`);
    assert.ok(layout.docScrollHeight <= slot.height + 1, `${slot.id}: document vertical overflow ${layout.docScrollHeight}/${slot.height}`);
    assert.ok(layout.bodyScrollHeight <= slot.height + 1, `${slot.id}: body vertical overflow ${layout.bodyScrollHeight}/${slot.height}`);
    assert.equal(layout.rowCount, 12, `${slot.id}: rendered row count`);
    assert.ok(layout.speakingRows >= 2, `${slot.id}: speaking rows not rendered`);
    assert.ok(Math.min(layout.mute.width, layout.mute.height) >= slot.minTouch, `${slot.id}: mute touch target below ${slot.minTouch}px`);
    assert.ok(Math.min(layout.deafen.width, layout.deafen.height) >= slot.minTouch, `${slot.id}: deafen touch target below ${slot.minTouch}px`);
    assert.equal(await page.locator("#muteButton").isDisabled(), false, `${slot.id}: mute unexpectedly disabled`);
    assert.equal(await page.locator("#deafenButton").isDisabled(), false, `${slot.id}: deafen unexpectedly disabled`);

    await page.locator(".member-row").first().click();
    assert.equal(await page.locator("#memberDetail").getAttribute("aria-hidden"), "false", `${slot.id}: member details did not open`);
    await page.locator("#detailClose").click();
    assert.equal(await page.locator("#memberDetail").getAttribute("aria-hidden"), "true", `${slot.id}: member details did not close`);

    if (slot.id === "m-h") {
      await page.evaluate(() => {
        globalThis.__PACKRAT_DISCORD_TEST__.speaking("1012", true);
        render();
      });
      assert.match(await page.locator(".member-row").first().innerText(), /Very Long Discord/, "speaker promotion failed");
      await page.evaluate(() => {
        globalThis.__PACKRAT_DISCORD_TEST__.speaking("1012", false);
        render();
      });
      assert.match(await page.locator(".member-row").first().innerText(), /Very Long Discord/, "900ms speaker hold failed immediately");
      await page.waitForTimeout(980);
      assert.doesNotMatch(await page.locator(".member-row").first().innerText(), /Very Long Discord/, "speaker hold did not expire");

      const added = member(13, { nick: "Late Join" });
      await page.evaluate((value) => globalThis.__PACKRAT_DISCORD_TEST__.voiceState(value), added);
      assert.equal((await page.evaluate(() => globalThis.__PACKRAT_DISCORD_TEST__.getState())).members.length, 13, "voice-state join failed");
      await page.evaluate((value) => globalThis.__PACKRAT_DISCORD_TEST__.remove(value), added);
      assert.equal((await page.evaluate(() => globalThis.__PACKRAT_DISCORD_TEST__.getState())).members.length, 12, "voice-state leave failed");

      await page.evaluate(() => globalThis.__PACKRAT_DISCORD_TEST__.selfVoice({ mute: true, deaf: true }));
      assert.equal(await page.locator("#muteLabel").innerText(), "Unmute", "mute state label failed");
      assert.equal(await page.locator("#deafenLabel").innerText(), "Undeafen", "deafen state label failed");

      const switched = liveSnapshot({
        channel: { ...fixture.channel, id: "555000000000000002", name: "Ranked Room", voice_states: members.slice(0, 3) },
        speaking: { "1001": true },
      });
      await page.evaluate((value) => globalThis.__PACKRAT_DISCORD_TEST__.snapshot(value), switched);
      let next = await page.evaluate(() => globalThis.__PACKRAT_DISCORD_TEST__.getState());
      assert.equal(next.channel?.name, "Ranked Room", "automatic channel switch failed");
      assert.equal(next.members.length, 3, "channel switch roster replacement failed");

      await page.evaluate((value) => globalThis.__PACKRAT_DISCORD_TEST__.snapshot(value), liveSnapshot({ channel: null, speaking: {} }));
      next = await page.evaluate(() => globalThis.__PACKRAT_DISCORD_TEST__.getState());
      assert.equal(next.state, "idle", "not-in-voice state failed");
      assert.equal(await page.locator("#muteButton").isDisabled(), true, "mute should disable outside voice");

      await page.evaluate((value) => globalThis.__PACKRAT_DISCORD_TEST__.snapshot(value), liveSnapshot({ discord: { connected: true, ready: true, authenticated: false, handshake: "ready" }, channel: null }));
      assert.equal((await page.evaluate(() => globalThis.__PACKRAT_DISCORD_TEST__.getState())).state, "authorization", "authorization state failed");

      await page.evaluate((value) => globalThis.__PACKRAT_DISCORD_TEST__.snapshot(value), liveSnapshot({ streamkit: { mode: "public_rpc", stage: "failed", lastError: "fixture" }, channel: null }));
      assert.equal((await page.evaluate(() => globalThis.__PACKRAT_DISCORD_TEST__.getState())).state, "auth-failed", "auth-failed state failed");

      await page.evaluate((value) => globalThis.__PACKRAT_DISCORD_TEST__.snapshot(value), liveSnapshot({ bridge: { port: 17483, listening: false, clients: 0 }, channel: null }));
      assert.equal((await page.evaluate(() => globalThis.__PACKRAT_DISCORD_TEST__.getState())).state, "disconnected", "bridge-disconnected state failed");
    }

    await page.screenshot({ path: path.join(artifactDir, `${slot.id}.png`), fullPage: false });
    assert.deepEqual(pageErrors, [], `${slot.id}: page errors: ${pageErrors.join(" | ")}`);
    assert.deepEqual(consoleErrors, [], `${slot.id}: console errors: ${consoleErrors.join(" | ")}`);

    results.push({ slot: slot.id, viewport: [slot.width, slot.height], minTouch: slot.minTouch, layout });
    await context.close();
  }
} finally {
  await browser.close();
}

await fs.writeFile(path.join(artifactDir, "results.json"), JSON.stringify({ entry, results }, null, 2));
console.log(`DISCORD PANEL VISUAL QA PASS: ${slots.length} XENEON compositions, runtime stability, overflow, touch targets, roster, speaking, details, joins/leaves, channel switching, voice state, and failure states`);
