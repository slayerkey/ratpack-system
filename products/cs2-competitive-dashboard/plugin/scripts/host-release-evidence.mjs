import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { releaseRuntimeFingerprint } from "./release-fingerprint.mjs";

const MIN_SUSTAINED_PACKET_CHECKPOINT = 300;

function defaultLogPath() {
  const root = process.env.PACKRAT_CS2_DATA_DIR
    ? path.resolve(process.env.PACKRAT_CS2_DATA_DIR)
    : process.platform === "win32" && process.env.APPDATA
      ? path.join(process.env.APPDATA, "PackRat", "CS2CompetitiveDashboard")
      : path.join(os.homedir(), ".packrat", "CS2CompetitiveDashboard");
  return path.join(root, "logs", "cs2-competitive-dashboard-pro.log");
}

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

const logPath = path.resolve(argValue("--log") ?? defaultLogPath());
if (!existsSync(logPath)) {
  console.error(`CS2 RELEASE EVIDENCE: FAIL\nLog not found: ${logPath}`);
  process.exit(1);
}

let coreAudit = "";
try {
  const args = ["scripts/host-log-audit.mjs", "--log", logPath];
  coreAudit = execFileSync(process.execPath, args, { encoding: "utf8" });
  process.stdout.write(coreAudit.endsWith("\n") ? coreAudit : `${coreAudit}\n`);
} catch (error) {
  const stdout = typeof error?.stdout === "string" ? error.stdout : error?.stdout?.toString?.() ?? "";
  const stderr = typeof error?.stderr === "string" ? error.stderr : error?.stderr?.toString?.() ?? "";
  if (stdout) process.stdout.write(stdout);
  if (stderr) process.stderr.write(stderr);
  console.error("\nCS2 RELEASE EVIDENCE: FAIL\nThe core host audit must pass before release evidence can be recorded.");
  process.exit(1);
}

const text = readFileSync(logPath, "utf8");
const latestStart = text.lastIndexOf("plugin process started");
const session = latestStart >= 0 ? text.slice(text.lastIndexOf("\n", latestStart) + 1) : text;
const lines = session.split(/\r?\n/).filter(Boolean);

let highestPacketCount = session.includes("first GSI payload received") ? 1 : 0;
for (const line of lines.filter((line) => line.includes("GSI payload heartbeat"))) {
  const match = line.match(/"requestCount":(\d+)/);
  if (match) highestPacketCount = Math.max(highestPacketCount, Number(match[1]));
}

const providerLines = lines.filter((line) => line.includes("provider refresh completed"));
const bothProvidersReadyLine = providerLines.find((line) =>
  /"leetifyStatus":"ready"/.test(line) && /"faceitStatus":"ready"/.test(line)
);
const bothProvidersReady = Boolean(bothProvidersReadyLine);
const openLogPass = session.includes("open log folder launched");
const diagnosticsReachable = coreAudit.includes("PASS  Redacted localhost diagnostics discovered");
const sustainedLivePass = highestPacketCount >= MIN_SUSTAINED_PACKET_CHECKPOINT;

const human = {
  hsPercentAccurateAcrossRespawns: hasFlag("--hs-ok"),
  longLabelsReadable: hasFlag("--labels-ok"),
  restartRecoveryPassed: hasFlag("--restart-ok")
};

const automated = {
  coreHostAuditPassed: coreAudit.includes("CS2 HOST AUDIT: PASS"),
  sustainedLivePass,
  highestPacketCount,
  openLogPass,
  diagnosticsReachable,
  leetifyReady: bothProvidersReady,
  faceitReady: bothProvidersReady,
  bothProvidersReady
};

const failures = [];
if (!automated.sustainedLivePass) failures.push(`sustained GSI evidence needs checkpoint >= ${MIN_SUSTAINED_PACKET_CHECKPOINT}; saw ${highestPacketCount}`);
if (!automated.openLogPass) failures.push("Open Log Folder was not successfully exercised in the latest plugin process");
if (!automated.diagnosticsReachable) failures.push("run this release audit while Stream Deck / the plugin is still running so localhost diagnostics can be verified");
if (!automated.bothProvidersReady) failures.push("no single real provider refresh reached ready for both Leetify and FACEIT in the latest plugin process");
if (!human.hsPercentAccurateAcrossRespawns) failures.push("missing human attestation --hs-ok");
if (!human.longLabelsReadable) failures.push("missing human attestation --labels-ok");
if (!human.restartRecoveryPassed) failures.push("missing human attestation --restart-ok");

console.log("\nCS2 PHYSICAL RELEASE EVIDENCE");
console.log(`${automated.sustainedLivePass ? "PASS" : "FAIL"}  Sustained live GSI (${highestPacketCount} packet checkpoint)`);
console.log(`${automated.openLogPass ? "PASS" : "FAIL"}  Open Log Folder`);
console.log(`${automated.diagnosticsReachable ? "PASS" : "FAIL"}  Live localhost diagnostics reachable`);
console.log(`${automated.bothProvidersReady ? "PASS" : "FAIL"}  Real Leetify + FACEIT providers ready in one refresh`);
console.log(`${human.hsPercentAccurateAcrossRespawns ? "PASS" : "FAIL"}  Human check: Deathmatch HS% across respawns`);
console.log(`${human.longLabelsReadable ? "PASS" : "FAIL"}  Human check: long labels readable`);
console.log(`${human.restartRecoveryPassed ? "PASS" : "FAIL"}  Human check: CS2 + Stream Deck restart recovery`);

if (failures.length) {
  console.log("\nCS2 RELEASE EVIDENCE: BLOCKED");
  for (const failure of failures) console.log(`  • ${failure}`);
  console.log("\nAfter both providers are ready together and all three visual/restart checks are true, run:");
  console.log("npm run host:audit:release -- --hs-ok --labels-ok --restart-ok");
  process.exit(1);
}

const evidenceDir = path.resolve(".release-evidence");
const evidencePath = path.join(evidenceDir, "host-pass.json");
mkdirSync(evidenceDir, { recursive: true });
const evidence = {
  schema: 1,
  product: "cs2-competitive-dashboard-pro",
  version: "0.1.0.0",
  passedAt: new Date().toISOString(),
  runtimeFingerprint: releaseRuntimeFingerprint(),
  log: {
    path: logPath,
    bytes: statSync(logPath).size,
    latestProcessStartedAt: lines[0]?.split(" | ")[0]
  },
  automated,
  human
};
writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
console.log(`\nCS2 RELEASE EVIDENCE: PASS\nEvidence written: ${evidencePath}`);
console.log("This file is local and gitignored. npm run release:final will require this exact runtime fingerprint.");
