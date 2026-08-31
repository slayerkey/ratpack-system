import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { releaseRuntimeFingerprint } from "./release-fingerprint.mjs";

const MAX_HOST_EVIDENCE_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const checks = [];

async function check(label, fn) {
  try {
    const detail = await fn();
    checks.push({ label, pass: true, detail });
  } catch (error) {
    checks.push({ label, pass: false, detail: error instanceof Error ? error.message : String(error) });
  }
}

async function exists(file) {
  try { await access(file); return true; } catch { return false; }
}

await check("Pro registry price is $14.99", async () => {
  const value = JSON.parse(await readFile("../../cs2-competitive-dashboard-pro.json", "utf8"));
  if (value.price_usd !== 14.99) throw new Error(`found ${value.price_usd}`);
  return "$14.99";
});

await check("Lite Marketplace launch remains held", async () => {
  const value = JSON.parse(await readFile("../../cs2-competitive-dashboard-lite.json", "utf8"));
  if (value.marketplace_launch !== "held") throw new Error(`marketplace_launch=${value.marketplace_launch ?? "missing"}`);
  if (!String(value.workflow_state ?? "").startsWith("BLOCKED_")) throw new Error(`Lite workflow_state=${value.workflow_state ?? "missing"}; held products must fail closed`);
  return value.marketplace_hold_reason ?? "held";
});

await check("Fresh matching physical Windows host evidence is present", async () => {
  const file = ".release-evidence/host-pass.json";
  if (!await exists(file)) {
    throw new Error(`missing ${file}; run npm run host:audit:release -- --hs-ok --labels-ok --restart-ok after the final physical Windows pass`);
  }
  const evidence = JSON.parse(await readFile(file, "utf8"));
  if (evidence.product !== "cs2-competitive-dashboard-pro" || evidence.version !== "0.1.0.0") {
    throw new Error("host evidence belongs to a different product/version");
  }
  const passedAt = Date.parse(evidence.passedAt);
  if (!Number.isFinite(passedAt)) throw new Error("host evidence has no valid passedAt timestamp");
  const age = Date.now() - passedAt;
  if (age < 0 || age > MAX_HOST_EVIDENCE_AGE_MS) throw new Error(`host evidence is stale (${Math.round(age / 3600000)}h old); repeat the final physical pass`);
  const expectedFingerprint = releaseRuntimeFingerprint();
  if (evidence.runtimeFingerprint !== expectedFingerprint) {
    throw new Error("runtime/UI/build inputs changed after the physical host pass; repeat the final physical pass on the current release candidate");
  }
  const automated = evidence.automated ?? {};
  const human = evidence.human ?? {};
  for (const [label, value] of [
    ["core host audit", automated.coreHostAuditPassed],
    ["sustained live GSI", automated.sustainedLivePass],
    ["Open Log Folder", automated.openLogPass],
    ["localhost diagnostics", automated.diagnosticsReachable],
    ["real Leetify provider", automated.leetifyReady],
    ["real FACEIT provider", automated.faceitReady],
    ["Deathmatch HS% human check", human.hsPercentAccurateAcrossRespawns],
    ["long-label human check", human.longLabelsReadable],
    ["restart recovery human check", human.restartRecoveryPassed]
  ]) {
    if (value !== true) throw new Error(`host evidence missing PASS: ${label}`);
  }
  return `${file} (${Math.round(age / 60000)} minutes old, runtime fingerprint matched)`;
});

await check("Official Leetify attribution source asset is present", async () => {
  const file = "static/ui/leetify-provided-dark.svg";
  if (!await exists(file)) throw new Error(`missing ${file}; obtain the official unmodified dark-background badge from Leetify's Developer Guidelines download`);
  const content = await readFile(file, "utf8");
  if (!content.trimStart().startsWith("<svg") && !content.includes("<svg")) throw new Error("attribution asset is not an SVG document");
  return file;
});

await check("Built Pro uses the official Leetify attribution image", async () => {
  const root = "out/com.packrat.cs2-competitive-dashboard-pro.sdPlugin/ui";
  const asset = path.join(root, "leetify-provided-dark.svg");
  if (!await exists(asset)) throw new Error("built Pro does not contain leetify-provided-dark.svg; run npm run build after adding the official asset");
  const html = await readFile(path.join(root, "property-inspector.html"), "utf8");
  if (!html.includes('class="attribution attribution-logo"') || !html.includes('src="leetify-provided-dark.svg"')) {
    throw new Error("built Property Inspector is not rendering the official attribution asset");
  }
  if (!html.includes('id="view-leetify"')) throw new Error("View on Leetify link surface is missing");
  return "official badge + View on Leetify surface present";
});

await check("Leetify paid product use is explicitly cleared", async () => {
  const file = "../LEETIFY_COMMERCIAL_CLEARANCE.md";
  const text = await readFile(file, "utf8");
  if (!/^Status:\s*CLEARED\s*$/im.test(text)) throw new Error(`commercial clearance is still pending in ${file}`);
  return "Status: CLEARED";
});

console.log("CS2 COMPETITIVE DASHBOARD PRO — FINAL MARKETPLACE GATE\n");
for (const item of checks) {
  console.log(`${item.pass ? "PASS" : "BLOCK"}  ${item.label}`);
  if (item.detail) console.log(`       ${item.detail}`);
}

const blocked = checks.filter((item) => !item.pass);
if (blocked.length) {
  console.log(`\nFINAL MARKETPLACE GATE: BLOCKED (${blocked.length} item${blocked.length === 1 ? "" : "s"})`);
  console.log("This does not mean the plugin is broken. It means the paid Marketplace release still has an explicit unresolved release requirement.");
  process.exitCode = 1;
} else {
  console.log("\nFINAL MARKETPLACE GATE: PASS");
  console.log("Physical host evidence, provider smoke, attribution, commercial clearance, pricing, and Lite hold policy are all satisfied for this runtime fingerprint.");
}
