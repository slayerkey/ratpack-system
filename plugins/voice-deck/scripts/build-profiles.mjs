import { createHash } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateRawSync } from "node:zlib";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const profileDir = resolve(root, "com.packrat.voice-deck.sdPlugin", "profiles");

const UUID = {
  status: "com.packrat.voice-deck.status",
  mute: "com.packrat.voice-deck.mute",
  deafen: "com.packrat.voice-deck.deafen",
  combined: "com.packrat.voice-deck.mute-deafen",
  channel: "com.packrat.voice-deck.channel",
  slot: "com.packrat.voice-deck.member-slot",
  spotlight: "com.packrat.voice-deck.spotlight",
  activity: "com.packrat.voice-deck.activity",
  count: "com.packrat.voice-deck.member-count",
  connection: "com.packrat.voice-deck.connection",
  navigator: "com.packrat.voice-deck.navigator",
};

function deterministicUuid(seed) {
  const hex = createHash("sha256").update(seed).digest("hex").slice(0, 32).split("");
  hex[12] = "4";
  hex[16] = ["8", "9", "a", "b"][parseInt(hex[16], 16) % 4];
  return `${hex.slice(0, 8).join("")}-${hex.slice(8, 12).join("")}-${hex.slice(12, 16).join("")}-${hex.slice(16, 20).join("")}-${hex.slice(20, 32).join("")}`.toUpperCase();
}

function pageFolderId(uuid) {
  const chunks = (uuid.replace(/-/g, "") + "000").match(/.{5}/g) || [];
  return chunks
    .map((chunk) => parseInt(chunk, 16).toString(32).padStart(4, "0"))
    .join("")
    .slice(0, 26)
    .toUpperCase()
    .replace(/V/g, "W")
    .replace(/U/g, "V") + "Z";
}

function action(seed, uuid, name, settings = {}) {
  return {
    ActionID: deterministicUuid(`action:${seed}`),
    LinkedTitle: true,
    Name: name,
    UUID: uuid,
    Settings: settings,
    State: 0,
    States: [{
      Title: "",
      ShowTitle: false,
      TitleAlignment: "middle",
      TitleColor: "#FFFFFF",
      FontFamily: "Arial",
      FontSize: 12,
      FontStyle: "Regular",
      FontUnderline: false,
    }],
  };
}

function slot(seed, index) {
  return action(seed, UUID.slot, `Member ${index}`, { slotIndex: index, ordering: "stable", showAvatar: true, showDisplayName: true });
}

function mk2Actions() {
  const actions = {
    "0,0": action("mk2-channel", UUID.channel, "Current Voice Channel", {}),
    "1,0": action("mk2-mute", UUID.mute, "Toggle Mute", {}),
    "2,0": action("mk2-deafen", UUID.deafen, "Toggle Deafen", {}),
    "3,0": action("mk2-spotlight", UUID.spotlight, "Speaker Spotlight", { showAvatar: true }),
    "4,0": action("mk2-connection", UUID.connection, "Discord Connection", {}),
  };
  for (let index = 1; index <= 10; index += 1) {
    const row = index <= 5 ? 1 : 2;
    const col = (index - 1) % 5;
    actions[`${col},${row}`] = slot(`mk2-slot-${index}`, index);
  }
  return actions;
}

function xlActions() {
  const top = [
    [UUID.status, "Voice Status"],
    [UUID.channel, "Current Voice Channel"],
    [UUID.mute, "Toggle Mute"],
    [UUID.deafen, "Toggle Deafen"],
    [UUID.combined, "Mute + Deafen"],
    [UUID.spotlight, "Speaker Spotlight"],
    [UUID.activity, "Voice Activity"],
    [UUID.connection, "Discord Connection"],
  ];
  const actions = {};
  top.forEach(([uuid, name], col) => { actions[`${col},0`] = action(`xl-top-${col}`, uuid, name, {}); });
  for (let index = 1; index <= 24; index += 1) {
    const offset = index - 1;
    const row = 1 + Math.floor(offset / 8);
    const col = offset % 8;
    actions[`${col},${row}`] = slot(`xl-slot-${index}`, index);
  }
  return actions;
}

function compactActions(prefix) {
  return {
    "0,0": action(`${prefix}-status`, UUID.status, "Voice Status", {}),
    "1,0": action(`${prefix}-mute`, UUID.mute, "Toggle Mute", {}),
    "2,0": action(`${prefix}-deafen`, UUID.deafen, "Toggle Deafen", {}),
    "3,0": action(`${prefix}-connection`, UUID.connection, "Discord Connection", {}),
    "0,1": slot(`${prefix}-slot-1`, 1),
    "1,1": slot(`${prefix}-slot-2`, 2),
    "2,1": slot(`${prefix}-slot-3`, 3),
    "3,1": slot(`${prefix}-slot-4`, 4),
  };
}

const PROFILE_SPECS = [
  { file: "voice-dashboard-mk2", name: "PackRat Voice Dashboard", keypad: mk2Actions() },
  { file: "voice-dashboard-xl", name: "PackRat Voice Dashboard XL", keypad: xlActions() },
  { file: "compact-voice-neo", name: "PackRat Compact Voice", keypad: compactActions("neo") },
  {
    file: "voice-dashboard-plus",
    name: "PackRat Voice Dashboard +",
    keypad: compactActions("plus"),
    encoder: {
      "0,0": action("plus-navigator", UUID.navigator, "Voice Navigator", {}),
    },
  },
];

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosStamp() {
  const year = 2026 - 1980;
  const date = (year << 9) | (1 << 5) | 1;
  const time = 0;
  return { date, time };
}

function zip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  const stamp = dosStamp();
  for (const [path, rawValue] of entries) {
    const name = Buffer.from(path.replace(/\\/g, "/"), "utf8");
    const raw = Buffer.isBuffer(rawValue) ? rawValue : Buffer.from(rawValue, "utf8");
    const compressed = deflateRawSync(raw, { level: 9 });
    const crc = crc32(raw);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(stamp.time, 10);
    local.writeUInt16LE(stamp.date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    const localRecord = Buffer.concat([local, name, compressed]);
    locals.push(localRecord);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(stamp.time, 12);
    central.writeUInt16LE(stamp.date, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centrals.push(Buffer.concat([central, name]));
    offset += localRecord.length;
  }
  const centralData = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralData.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...locals, centralData, end]);
}

function buildProfile(spec) {
  const rootUuid = deterministicUuid(`profile-root:${spec.file}`);
  const pageUuid = deterministicUuid(`profile-page:${spec.file}`);
  const folder = pageFolderId(pageUuid);
  const rootPath = `${rootUuid}.sdProfile`;
  const bundle = {
    Name: spec.name,
    Pages: { Current: pageUuid, Pages: [pageUuid] },
    Version: "2.0",
  };
  const controllers = [{ Actions: spec.keypad, Type: "Keypad" }];
  if (spec.encoder) controllers.push({ Actions: spec.encoder, Type: "Encoder" });
  const page = { Controllers: controllers };
  return zip([
    [`${rootPath}/manifest.json`, JSON.stringify(bundle, null, 2)],
    [`${rootPath}/Profiles/${folder}/manifest.json`, JSON.stringify(page, null, 2)],
  ]);
}

await rm(profileDir, { recursive: true, force: true });
await mkdir(profileDir, { recursive: true });
for (const spec of PROFILE_SPECS) {
  const file = resolve(profileDir, `${spec.file}.streamDeckProfile`);
  await writeFile(file, buildProfile(spec));
  console.log(`Built profile ${spec.file}`);
}
