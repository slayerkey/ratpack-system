import { existsSync, readFileSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";

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

const logPath = path.resolve(argValue("--log") ?? defaultLogPath());

if (!existsSync(logPath)) {
  console.error("CS2 HOST AUDIT: FAIL");
  console.error(`Log not found: ${logPath}`);
  console.error("Run rat dev cs2-competitive-dashboard, launch CS2, enter a real match, then run this audit again.");
  process.exit(1);
}

const text = readFileSync(logPath, "utf8");
const latestStart = text.lastIndexOf("plugin process started");
const session = latestStart >= 0 ? text.slice(text.lastIndexOf("\n", latestStart) + 1) : text;
const lines = session.split(/\r?\n/).filter(Boolean);

const checks = [
  ["Stream Deck connected", "Stream Deck connection succeeded"],
  ["CS2 install detected", "CS2 install selected"],
  ["CFG writable", "CFG write probe complete"],
  ["Local listener bound", "listener bind succeeded"],
  ["GSI setup ready", "automatic GSI setup ready"],
  ["Real GSI packet received", "first GSI payload received"],
  ["GSI payload normalized", "payload normalization succeeded"],
  ["Runtime connected", "runtime marked connected"]
];

const hardFailurePatterns = [
  ["Unhandled promise rejection", /unhandled rejection/i],
  ["Stream Deck SDK timeout", /the request timed out/i],
  ["Stream Deck connection failure", /Stream Deck connection failed/i],
  ["Automatic GSI startup failure", /automatic GSI host startup failed/i],
  ["Listener bind failure", /listener bind failed(?!.*attempt)/i],
  ["GSI config installation failure", /GSI config installation failed/i],
  ["Payload normalization failure", /payload normalization failed/i]
];

const warnings = [
  ["Settings channel issue", /global settings load failed/i],
  ["Provider refresh issue", /provider refresh failed|provider refresh after settings change failed|initial provider refresh failed|scheduled provider refresh failed/i],
  ["Open Log Folder failure", /open log folder failed/i],
  ["GSI connection became stale", /GSI connection became stale/i]
];

const contains = (needle) => session.includes(needle);
const results = checks.map(([label, marker]) => ({ label, pass: contains(marker), marker }));
const failures = hardFailurePatterns.map(([label, pattern]) => ({
  label,
  count: lines.filter((line) => pattern.test(line)).length
})).filter((item) => item.count > 0);
const warningResults = warnings.map(([label, pattern]) => ({
  label,
  count: lines.filter((line) => pattern.test(line)).length
})).filter((item) => item.count > 0);

const heartbeatLines = lines.filter((line) => line.includes("GSI payload heartbeat"));
let highestPacketCount = contains("first GSI payload received") ? 1 : 0;
for (const line of heartbeatLines) {
  const match = line.match(/"requestCount":(\d+)/);
  if (match) highestPacketCount = Math.max(highestPacketCount, Number(match[1]));
}

const openLogAttempted = contains("open log folder launched") || lines.some((line) => /open log folder failed/i.test(line));
const openLogPass = contains("open log folder launched");
const size = statSync(logPath).size;
const missing = results.filter((result) => !result.pass);
const pass = missing.length === 0 && failures.length === 0;

console.log("CS2 COMPETITIVE DASHBOARD PRO — HOST RELEASE AUDIT");
console.log(`Log: ${logPath}`);
console.log(`Latest process segment: ${lines.length} log lines, ${(size / 1024).toFixed(1)} KB total log file`);
console.log("");
for (const result of results) {
  console.log(`${result.pass ? "PASS" : "FAIL"}  ${result.label}`);
}
console.log(`${failures.length === 0 ? "PASS" : "FAIL"}  No timeout / unhandled-rejection / core GSI failure signatures`);
console.log(`${openLogAttempted ? (openLogPass ? "PASS" : "FAIL") : "NOTE"}  Open Log Folder ${openLogAttempted ? (openLogPass ? "launched successfully" : "was attempted and failed") : "was not exercised in this process"}`);
console.log(`INFO  Highest logged GSI packet checkpoint: ${highestPacketCount || "none"}`);

if (warningResults.length) {
  console.log("\nWarnings seen in latest process:");
  for (const warning of warningResults) console.log(`WARN  ${warning.label}: ${warning.count}`);
}

if (!pass) {
  console.log("\nCS2 HOST AUDIT: FAIL");
  if (missing.length) {
    console.log("Missing required evidence:");
    for (const result of missing) console.log(`  • ${result.label} (${result.marker})`);
  }
  if (failures.length) {
    console.log("Hard failure signatures:");
    for (const failure of failures) console.log(`  • ${failure.label}: ${failure.count}`);
  }
  console.log("\nSend this audit output together with Copy Diagnostic Summary and the Pro log. That should be enough for one-pass debugging.");
  process.exitCode = 1;
} else {
  console.log("\nCS2 HOST AUDIT: PASS");
  console.log("Automated host evidence is clean. Finish the human checks for HS% accuracy, physical-key readability, Open Log Folder, provider data, and restart recovery before shipping.");
}
