import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

const entry = path.resolve(process.argv[2] || "widgets/_src/discord-panel/index.html");
const artifactDir = path.resolve(process.argv[3] || "artifacts/discord-panel-stress");
await fs.mkdir(artifactDir, { recursive: true });

const slots = [
  { id: "s-h", width: 840, height: 344 },
  { id: "s-v", width: 696, height: 416 },
  { id: "m-h", width: 840, height: 696 },
  { id: "m-v", width: 696, height: 840 },
  { id: "l-h", width: 1688, height: 696 },
  { id: "l-v", width: 696, height: 1688 },
  { id: "xl-h", width: 2536, height: 696 },
  { id: "xl-v", width: 696, height: 2536 },
];

const maliciousName = `<img id="packrat-xss" src=x onerror="globalThis.__PACKRAT_XSS__=true"> <script>globalThis.__PACKRAT_XSS__=true</script>`;

function member(index) {
  const id = String(900000 + index);
  let nick = `Crowded Member ${String(index).padStart(2, "0")}`;
  if (index === 7) nick = maliciousName;
  if (index === 19) nick = "超長い表示名 🚀🐀 Discord Voice Test — Καλημέρα — Привет — مرحبا — ñáéíóú — ".repeat(3);
  if (index === 50) nick = "LAST MEMBER FOR SCROLL PROOF";
  return {
    nick,
    mute: false,
    volume: 100,
    pan: { left: 1, right: 1 },
    voice_state: {
      mute: false,
      deaf: false,
      self_mute: index % 11 === 0,
      self_deaf: index % 17 === 0,
      suppress: false,
    },
    user: {
      id,
      username: `crowded${index}`,
      discriminator: "0",
      global_name: null,
      avatar: null,
      bot: false,
      flags: 0,
      premium_type: 0,
    },
  };
}

const members = Array.from({ length: 50 }, (_, index) => member(index + 1));
const fixture = {
  user: { id: "900001", username: "fixture-owner", global_name: "Fixture Owner" },
  voice: { mute: false, deaf: false },
  channel: {
    id: "888000000000000001",
    guild_id: "888000000000000000",
    name: "A deliberately enormous Discord voice channel name 🚀🐀 — with Unicode — that must ellipsize instead of widening the XENEON viewport ".repeat(2),
    type: 2,
    voice_states: members,
  },
  speaking: ["900002", "900019", "900049"],
  activity: Array.from({ length: 8 }, (_, index) => ({ userId: String(900001 + index), name: `Recent ${index + 1}`, at: Date.now() - index * 500 })),
};

const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const slot of slots) {
    const context = await browser.newContext({
      viewport: { width: slot.width, height: slot.height },
      reducedMotion: "reduce",
    });
    await context.addInitScript(({ fixture }) => {
      globalThis.__PACKRAT_DISCORD_FIXTURE__ = fixture;
      globalThis.icueEvents = function () {};
      globalThis.showRecentActivity = false;
      globalThis.textColor = "#ABCDEF";
      globalThis.accentColor = "#123456";
      globalThis.backgroundColor = "#010203";
      globalThis.__PACKRAT_XSS__ = false;
    }, { fixture });

    const page = await context.newPage();
    const pageErrors = [];
    const consoleErrors = [];
    page.on("pageerror", (error) => pageErrors.push(String(error?.stack || error)));
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });

    await page.goto(pathToFileURL(entry).href, { waitUntil: "load" });
    await page.waitForFunction(() => Boolean(globalThis.__PACKRAT_DISCORD_TEST__));
    await page.waitForTimeout(1250);

    const metrics = await page.evaluate(() => {
      const roster = document.getElementById("roster");
      const channel = document.getElementById("channelName");
      const root = getComputedStyle(document.documentElement);
      const speakerBefore = getComputedStyle(document.querySelector(".member-row.speaking .avatar-wrap"), "::before");
      return {
        state: globalThis.__PACKRAT_DISCORD_TEST__.getState(),
        rowCount: document.querySelectorAll(".member-row").length,
        docWidth: document.documentElement.scrollWidth,
        docHeight: document.documentElement.scrollHeight,
        bodyWidth: document.body.scrollWidth,
        bodyHeight: document.body.scrollHeight,
        rosterClientHeight: roster.clientHeight,
        rosterScrollHeight: roster.scrollHeight,
        rosterNeedsScroll: roster.scrollHeight > roster.clientHeight + 1,
        channelClientWidth: channel.clientWidth,
        channelScrollWidth: channel.scrollWidth,
        recentOff: document.body.classList.contains("recent-off"),
        textVar: root.getPropertyValue("--text").trim().toUpperCase(),
        accentVar: root.getPropertyValue("--accent").trim().toUpperCase(),
        bgVar: root.getPropertyValue("--bg").trim().toUpperCase(),
        speakerAnimation: speakerBefore.animationName,
        xssFlag: Boolean(globalThis.__PACKRAT_XSS__),
        injectedElement: Boolean(document.getElementById("packrat-xss")),
        maliciousTextPresent: Array.from(document.querySelectorAll(".member-name")).some((node) => node.textContent.includes("<img id=\"packrat-xss\"")),
      };
    });

    assert.equal(metrics.state.state, "voice", `${slot.id}: crowded fixture not in voice state`);
    assert.equal(metrics.state.members.length, 50, `${slot.id}: state lost crowded members`);
    assert.equal(metrics.rowCount, 50, `${slot.id}: DOM lost crowded members`);
    assert.ok(metrics.docWidth <= slot.width + 1, `${slot.id}: crowded document horizontal overflow`);
    assert.ok(metrics.bodyWidth <= slot.width + 1, `${slot.id}: crowded body horizontal overflow`);
    assert.ok(metrics.docHeight <= slot.height + 1, `${slot.id}: crowded document vertical overflow`);
    assert.ok(metrics.bodyHeight <= slot.height + 1, `${slot.id}: crowded body vertical overflow`);
    assert.ok(metrics.rosterScrollHeight >= metrics.rosterClientHeight, `${slot.id}: invalid roster geometry`);
    assert.ok(metrics.channelScrollWidth >= metrics.channelClientWidth, `${slot.id}: long channel stress was not represented`);
    assert.equal(metrics.recentOff, true, `${slot.id}: iCUE recent-activity setting did not apply`);
    assert.equal(metrics.textVar, "#ABCDEF", `${slot.id}: iCUE text color did not apply`);
    assert.equal(metrics.accentVar, "#123456", `${slot.id}: iCUE accent color did not apply`);
    assert.equal(metrics.bgVar, "#010203", `${slot.id}: iCUE background color did not apply`);
    assert.equal(metrics.speakerAnimation, "none", `${slot.id}: prefers-reduced-motion did not disable speaking animation`);
    assert.equal(metrics.xssFlag, false, `${slot.id}: member name executed injected script`);
    assert.equal(metrics.injectedElement, false, `${slot.id}: member name was parsed as HTML`);
    assert.equal(metrics.maliciousTextPresent, true, `${slot.id}: malicious-looking name was not rendered safely as text`);

    if (metrics.rosterNeedsScroll) {
      await page.evaluate(() => {
        const roster = document.getElementById("roster");
        roster.scrollTop = roster.scrollHeight;
      });
      await page.waitForTimeout(50);
    }
    const reachabilityProof = await page.evaluate(() => {
      const roster = document.getElementById("roster");
      const last = Array.from(document.querySelectorAll(".member-row")).find((row) => row.textContent.includes("LAST MEMBER FOR SCROLL PROOF"));
      const rosterRect = roster.getBoundingClientRect();
      const lastRect = last.getBoundingClientRect();
      return {
        scrollTop: roster.scrollTop,
        needsScroll: roster.scrollHeight > roster.clientHeight + 1,
        visible: lastRect.bottom <= rosterRect.bottom + 1 && lastRect.top >= rosterRect.top - 1,
      };
    });
    if (reachabilityProof.needsScroll) assert.ok(reachabilityProof.scrollTop > 0, `${slot.id}: roster needed scrolling but could not scroll`);
    assert.equal(reachabilityProof.visible, true, `${slot.id}: final crowded member was not reachable`);

    assert.deepEqual(pageErrors, [], `${slot.id}: page errors: ${pageErrors.join(" | ")}`);
    assert.deepEqual(consoleErrors, [], `${slot.id}: console errors: ${consoleErrors.join(" | ")}`);
    await page.screenshot({ path: path.join(artifactDir, `${slot.id}.png`), fullPage: false });
    results.push({ slot: slot.id, viewport: [slot.width, slot.height], metrics, reachabilityProof });
    await context.close();
  }
} finally {
  await browser.close();
}

await fs.writeFile(path.join(artifactDir, "results.json"), JSON.stringify({ entry, results }, null, 2));
console.log("DISCORD PANEL STRESS QA PASS: 50-member rosters across all eight XENEON sizes, member reachability, long Unicode text, HTML-injection safety, iCUE appearance settings, and reduced-motion behavior");
