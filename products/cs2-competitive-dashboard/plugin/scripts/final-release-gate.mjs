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

function clearanceField(text, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.match(new RegExp(`^${escaped}:\\s*(.+?)\\s*$`, "im"))?.[1]?.trim();
}

function requireClearanceField(text, name) {
  const value = clearanceField(text, name);
  if (!value || /^(?:PENDING|TBD|TODO|N\/A)$/i.test(value)) throw new Error(`${name} is missing or still a placeholder`);
  return value;
}

await check("Pro registry price is $14.99", async () => {
  const value = JSON.parse(await readFile("../../cs2-competitive-dashboard-pro.json", "utf8"));
  if (value.price_usd !== 14.99) throw new Error(`found ${value.price_usd}`);
  return "$14.99";
});

await check("Lite Marketplace launch remains held", async () => {
  const value = JSON.parse(await readFile("../../cs2-competitive-dashboard-lite.json", "utf8"));
  if (value.marketplace_launch !== "held") throw new Error(`marketplace_launch=${value.marketplace_launch ?? "missing"}`);
  const state = String(value.workflow_state ?? "").trim().toUpperCase();
  if (!(state === "BLOCKED" || state.startsWith("BLOCKED_"))) {
    throw new Error(`Lite workflow_state=${value.workflow_state ?? "missing"}; held products must fail closed`);
  }
  if (value.blocker_kind !== "strategy_hold") {
    throw new Error(`Lite blocker_kind=${value.blocker_kind ?? "missing"}; expected strategy_hold`);
  }
  return value.marketplace_hold_reason ?? "held";
});

await check("Fresh matching physical Windows host evidence is present", async () => {
  const file = ".release-evidence/host-pass.json";
  if (!await exists(file)) {
    throw new Error(`missing ${file}; run npm run host:audit:release -- --hs-ok --labels-ok --restart-ok after the final physical Windows pass`);
  }
  const evidence = JSON.parse(await readFile(file, "utf8"));
  if (evidence.schema !== 2) throw new Error(`host evidence schema ${evidence.schema ?? "missing"} is obsolete; repeat the final physical pass with the fingerprint-aware release audit`);
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
  if (automated.sourceRuntimeFingerprint !== expectedFingerprint) throw new Error("host evidence source fingerprint does not match the current release source");
  if (automated.runningRuntimeFingerprint !== expectedFingerprint) throw new Error("host evidence running Stream Deck fingerprint does not match the current release source");
  for (const [label, value] of [
    ["running runtime/source fingerprint match", automated.runtimeFingerprintMatched],
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
  return `${file} (${Math.round(age / 60000)} minutes old, running + source fingerprint matched)`;
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

await check("Leetify paid product use has complete written clearance evidence", async () => {
  const file = "../LEETIFY_COMMERCIAL_CLEARANCE.md";
  const text = await readFile(file, "utf8");
  if (!/^Status:\s*CLEARED\s*$/im.test(text)) throw new Error(`commercial clearance is still pending in ${file}`);

  const approvalDate = requireClearanceField(text, "Approval-Date");
  const approvalChannel = requireClearanceField(text, "Approval-Channel");
  const approvalScope = requireClearanceField(text, "Approval-Scope");
  const approvalReference = requireClearanceField(text, "Approval-Reference");
  const assetSource = requireClearanceField(text, "Attribution-Asset-Source");
  requireClearanceField(text, "Additional-Conditions");

  if (!/^\d{4}-\d{2}-\d{2}$/.test(approvalDate)) throw new Error("Approval-Date must use YYYY-MM-DD");
  if (!/14\.99/.test(approvalScope) || !/customer.?owned/i.test(approvalScope) || !/api.?key/i.test(approvalScope)) {
    throw new Error("Approval-Scope must explicitly cover the $14.99 one-time product and customer-owned API-key model");
  }
  if (approvalReference.length < 3) throw new Error("Approval-Reference is too short to identify written approval evidence");
  if (approvalChannel.length < 2) throw new Error("Approval-Channel is too short to identify the Leetify approval source");
  if (!/(leetify|drive\.google\.com)/i.test(assetSource)) throw new Error("Attribution-Asset-Source must identify the official Leetify source/package");

  return `written approval recorded ${approvalDate} via ${approvalChannel}`;
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
  console.log("Physical host evidence, exact running/source fingerprint, provider smoke, official attribution, documented commercial clearance, pricing, and Lite hold policy are all satisfied.");
}
