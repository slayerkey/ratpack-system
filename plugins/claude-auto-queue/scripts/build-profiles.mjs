import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PLUGIN = path.join(ROOT, "com.packrat.claude-auto-queue.sdPlugin");
const PROFILE_DIR = path.join(PLUGIN, "profiles");

const UUIDS = {
  status: "com.packrat.claude-auto-queue.status",
  queue: "com.packrat.claude-auto-queue.queue-prompt",
  next: "com.packrat.claude-auto-queue.next-prompt",
  control: "com.packrat.claude-auto-queue.queue-control"
};

const PROMPTS = {
  "RUN TESTS": "Run the relevant test suite. Fix failures you can resolve safely, verify the result, and summarize what changed.",
  "FIX ERRORS": "Investigate the current errors or failing checks. Fix the root cause, verify the fix, and summarize the result.",
  "REVIEW CODE": "Review the current implementation for correctness, regressions, edge cases, and maintainability. Fix clear issues you find and summarize the review.",
  CONTINUE: "Continue with the next logical implementation step based on the current conversation and project state.",
  DOCUMENT: "Update the relevant documentation for the work completed in this conversation. Keep it concise and accurate.",
  "COMMIT LOCAL": "If the current changes are ready, create an appropriate local git commit with a concise message. Do not push. If they are not ready, explain what remains.",
  VERIFY: "Verify the current implementation end to end using the most relevant checks available. Fix clear regressions and report the final result.",
  "PLAN NEXT": "Review the current project and conversation state, identify the highest value next implementation step, and begin it if it is safe and unambiguous.",
  SUMMARIZE: "Summarize what was completed in this conversation, what was verified, and anything that still needs attention.",
  "FINISH TASK": "Continue the current task to a clean stopping point. Complete the remaining safe implementation work, run relevant checks, and summarize the result."
};

function deterministicUuid(seed) {
  const hex = createHash("sha256").update(seed).digest("hex").slice(0, 32).split("");
  hex[12] = "4";
  hex[16] = ((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  const value = hex.join("").toUpperCase();
  return `${value.slice(0,8)}-${value.slice(8,12)}-${value.slice(12,16)}-${value.slice(16,20)}-${value.slice(20)}`;
}

function action(seed, name, uuid, settings = {}) {
  return {
    ActionID: deterministicUuid(`auto-queue:${seed}`),
    LinkedTitle: true,
    Name: name,
    UUID: uuid,
    Settings: settings,
    State: 0,
    States: [{ Title: "" }]
  };
}

function queue(seed, label) {
  return action(seed, "Queue Prompt", UUIDS.queue, { label, prompt: PROMPTS[label] });
}

function status(seed) { return action(seed, "Claude Status", UUIDS.status, {}); }
function next(seed) { return action(seed, "Next Prompt", UUIDS.next, {}); }
function control(seed, operation) { return action(seed, "Queue Control", UUIDS.control, { operation }); }

const STANDARD = {
  "0,0": status("standard:status"),
  "1,0": queue("standard:tests", "RUN TESTS"),
  "2,0": queue("standard:errors", "FIX ERRORS"),
  "3,0": queue("standard:review", "REVIEW CODE"),
  "4,0": queue("standard:continue", "CONTINUE"),
  "0,1": next("standard:next"),
  "1,1": queue("standard:document", "DOCUMENT"),
  "2,1": queue("standard:commit", "COMMIT LOCAL"),
  "3,1": queue("standard:verify", "VERIFY"),
  "4,1": queue("standard:plan", "PLAN NEXT"),
  "0,2": control("standard:remove", "remove-next"),
  "1,2": control("standard:rotate", "rotate"),
  "2,2": control("standard:clear", "clear"),
  "3,2": queue("standard:summary", "SUMMARIZE"),
  "4,2": queue("standard:finish", "FINISH TASK")
};

const COMPACT = {
  "0,0": status("compact:status"),
  "1,0": queue("compact:tests", "RUN TESTS"),
  "2,0": queue("compact:errors", "FIX ERRORS"),
  "3,0": queue("compact:continue", "CONTINUE"),
  "0,1": next("compact:next"),
  "1,1": queue("compact:review", "REVIEW CODE"),
  "2,1": control("compact:remove", "remove-next"),
  "3,1": control("compact:clear", "clear")
};

const MINI = {
  "0,0": status("mini:status"),
  "1,0": queue("mini:tests", "RUN TESTS"),
  "2,0": queue("mini:continue", "CONTINUE"),
  "0,1": next("mini:next"),
  "1,1": control("mini:remove", "remove-next"),
  "2,1": control("mini:clear", "clear")
};

const PROFILES = [
  { file: "auto-queue-standard", name: "Auto Queue for Claude Code", actions: STANDARD },
  { file: "auto-queue-xl", name: "Auto Queue for Claude Code XL", actions: STANDARD },
  { file: "auto-queue-plus", name: "Auto Queue for Claude Code +", actions: COMPACT },
  { file: "auto-queue-neo", name: "Auto Queue for Claude Code Neo", actions: COMPACT },
  { file: "auto-queue-mini", name: "Auto Queue for Claude Code Mini", actions: MINI }
];

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function zipStore(entries) {
  const local = [];
  const central = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name.replaceAll("\\", "/"), "utf8");
    const data = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data, "utf8");
    const crc = crc32(data);
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(data.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(name.length, 26);
    localHeader.writeUInt16LE(0, 28);
    local.push(localHeader, name, data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(data.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    central.push(centralHeader, name);
    offset += localHeader.length + name.length + data.length;
  }

  const centralBuffer = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuffer.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...local, centralBuffer, end]);
}

export async function buildProfiles() {
  await mkdir(PROFILE_DIR, { recursive: true });
  for (const profile of PROFILES) {
    const rootUuid = deterministicUuid(`auto-queue-profile:${profile.file}`);
    const manifest = {
      Actions: profile.actions,
      Name: profile.name,
      Version: "1.0"
    };
    const archive = zipStore([{
      name: `${rootUuid}.sdProfile/manifest.json`,
      data: `${JSON.stringify(manifest, null, 2)}\n`
    }]);
    await writeFile(path.join(PROFILE_DIR, `${profile.file}.streamDeckProfile`), archive);
  }
}

if (path.resolve(process.argv[1] || "") === fileURLToPath(import.meta.url)) {
  await buildProfiles();
  console.log(`Built ${PROFILES.length} bundled Auto Queue profiles.`);
}
