import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export const PROFILE_DEVICES = [
  { id: "stream-deck", label: "Stream Deck", deviceType: 0, columns: 5, rows: 3 },
  { id: "mini", label: "Stream Deck Mini", deviceType: 1, columns: 3, rows: 2 },
  { id: "xl", label: "Stream Deck XL", deviceType: 2, columns: 8, rows: 4 },
  { id: "plus", label: "Stream Deck +", deviceType: 7, columns: 4, rows: 2 },
  { id: "neo", label: "Stream Deck Neo", deviceType: 9, columns: 4, rows: 2 }
];

const LITE_ITEMS = [
  item("live", "score"),
  item("live", "health"),
  item("live", "money"),
  item("live", "map"),
  item("status")
];

const LIVE_6 = [
  item("live", "score"),
  item("live", "round"),
  item("live", "kd"),
  item("live", "health"),
  item("live", "money"),
  item("status")
];

const LIVE_8 = [
  item("live", "score"),
  item("live", "round"),
  item("live", "kd"),
  item("live", "health"),
  item("live", "money"),
  item("live", "weapon"),
  item("live", "map"),
  item("status")
];

const LIVE_15 = [
  item("live", "score"),
  item("live", "round"),
  item("live", "kills"),
  item("live", "deaths"),
  item("live", "kd"),
  item("live", "health"),
  item("live", "armor"),
  item("live", "money"),
  item("live", "weapon"),
  item("live", "ammo"),
  item("session", "adr"),
  item("session", "hs"),
  item("live", "bomb"),
  item("live", "map"),
  item("status")
];

const LIVE_XL = [
  ...[
    "score", "round", "kills", "deaths", "assists", "kd", "adr", "hs",
    "health", "armor", "money", "equipment", "weapon", "ammo", "bomb", "map", "team"
  ].map((metric) => item("live", metric)),
  ...["record", "matches", "kd", "adr", "hs"].map((metric) => item("session", metric)),
  item("status")
];

const COMPETITIVE_6 = [
  item("competitive", "premier"),
  item("competitive", "current-map-rank"),
  item("faceit", "elo"),
  item("faceit", "level"),
  item("session", "record"),
  item("status")
];

const COMPETITIVE_8 = [
  item("competitive", "premier"),
  item("competitive", "current-map-rank"),
  item("competitive", "recent-result"),
  item("faceit", "elo"),
  item("faceit", "level"),
  item("faceit", "recent-record"),
  item("session", "record"),
  item("status")
];

const COMPETITIVE_15 = [
  item("competitive", "premier"),
  item("competitive", "current-map-rank"),
  item("competitive", "best-map-rank"),
  item("competitive", "recent-result"),
  item("competitive", "win-rate"),
  item("faceit", "elo"),
  item("faceit", "level"),
  item("faceit", "kd"),
  item("faceit", "hs"),
  item("faceit", "recent-record"),
  item("session", "record"),
  item("session", "kd"),
  item("session", "adr"),
  item("session", "hs"),
  item("status")
];

const COMPETITIVE_XL = [
  ...[
    "premier", "current-map-rank", "best-map-rank", "recent-result", "win-rate", "leetify-rating"
  ].map((metric) => item("competitive", metric)),
  ...[
    "elo", "level", "region", "kd", "hs", "win-rate", "recent-record", "recent-match"
  ].map((metric) => item("faceit", metric)),
  ...["record", "matches", "kd", "adr", "hs"].map((metric) => item("session", metric)),
  item("status")
];

export async function generateBundledProfiles(build) {
  const profilesDir = path.join(build.output, "profiles");
  await mkdir(profilesDir, { recursive: true });

  const registrations = [];
  const kinds = build.flavor === "pro" ? ["competitive", "live"] : ["starter"];

  for (const device of PROFILE_DEVICES) {
    for (const kind of kinds) {
      const fileStem = `${build.flavor}-${kind}-${device.id}`;
      const displayName = profileDisplayName(build.flavor, kind, device.label);
      const actions = layoutActions(build, kind, device);
      const archive = createProfileArchive({
        seed: `${build.uuid}|${kind}|${device.id}`,
        name: displayName,
        actions
      });

      await writeFile(path.join(profilesDir, `${fileStem}.streamDeckProfile`), archive);
      registrations.push({
        Name: `profiles/${fileStem}`,
        DeviceType: device.deviceType,
        Readonly: false,
        DontAutoSwitchWhenInstalled: true,
        AutoInstall: true
      });
    }
  }

  return registrations;
}

function layoutActions(build, kind, device) {
  const capacity = device.columns * device.rows;
  const source = kind === "starter"
    ? LITE_ITEMS
    : kind === "live"
      ? chooseByCapacity(capacity, LIVE_6, LIVE_8, LIVE_15, LIVE_XL)
      : chooseByCapacity(capacity, COMPETITIVE_6, COMPETITIVE_8, COMPETITIVE_15, COMPETITIVE_XL);

  const actions = {};
  for (const [index, definition] of source.slice(0, capacity).entries()) {
    const column = index % device.columns;
    const row = Math.floor(index / device.columns);
    actions[`${column},${row}`] = pluginAction(build, definition, `${kind}|${device.id}|${index}`);
  }
  return actions;
}

function chooseByCapacity(capacity, six, eight, fifteen, xl) {
  if (capacity <= 6) return six;
  if (capacity <= 8) return eight;
  if (capacity <= 15) return fifteen;
  return xl;
}

function pluginAction(build, definition, seed) {
  const actionName = {
    live: "Live Metric",
    session: "Session Metric",
    competitive: "Competitive Metric",
    faceit: "FACEIT Metric",
    status: "CS2 Status"
  }[definition.family];

  return {
    ActionID: deterministicUuid(`${build.uuid}|action|${seed}`),
    LinkedTitle: true,
    Name: actionName,
    UUID: `${build.uuid}.${definition.family}`,
    Settings: definition.metric ? { metric: definition.metric } : {},
    State: 0,
    States: [{ Title: "", ShowTitle: false }]
  };
}

function item(family, metric) {
  return { family, metric };
}

function profileDisplayName(flavor, kind, deviceLabel) {
  if (flavor === "lite") return `CS2 Dashboard Lite — ${deviceLabel}`;
  if (kind === "live") return `CS2 Live Match — ${deviceLabel}`;
  return `CS2 Competitive — ${deviceLabel}`;
}

function createProfileArchive({ seed, name, actions }) {
  const rootUuid = deterministicUuid(`${seed}|root`).toUpperCase();
  const pageUuid = deterministicUuid(`${seed}|page`);
  const pageFolder = profileFolderId(pageUuid);
  const root = `${rootUuid}.sdProfile`;

  const bundleManifest = {
    Device: { Model: "", UUID: "" },
    Name: name,
    Pages: { Current: pageUuid, Pages: [pageUuid] },
    Version: "2.0"
  };
  const pageManifest = {
    Controllers: [{ Actions: actions, Type: "Keypad" }]
  };

  return createStoredZip([
    [`${root}/manifest.json`, jsonBuffer(bundleManifest)],
    [`${root}/Profiles/${pageFolder}/manifest.json`, jsonBuffer(pageManifest)]
  ]);
}

function deterministicUuid(seed) {
  const bytes = Buffer.from(createHash("sha256").update(seed).digest().subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function profileFolderId(uuid) {
  return ((uuid.replaceAll("-", "") + "000").match(/.{5}/g) ?? [])
    .map((value) => Number.parseInt(value, 16).toString(32).padStart(4, "0"))
    .join("")
    .slice(0, 26)
    .toUpperCase()
    .replaceAll("V", "W")
    .replaceAll("U", "V") + "Z";
}

function jsonBuffer(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function createStoredZip(entries) {
  const locals = [];
  const central = [];
  let offset = 0;

  for (const [name, data] of entries) {
    const fileName = Buffer.from(name, "utf8");
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(fileName.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, fileName, data);

    const header = Buffer.alloc(46);
    header.writeUInt32LE(0x02014b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(20, 6);
    header.writeUInt16LE(0, 8);
    header.writeUInt16LE(0, 10);
    header.writeUInt16LE(0, 12);
    header.writeUInt16LE(0, 14);
    header.writeUInt32LE(crc, 16);
    header.writeUInt32LE(data.length, 20);
    header.writeUInt32LE(data.length, 24);
    header.writeUInt16LE(fileName.length, 28);
    header.writeUInt16LE(0, 30);
    header.writeUInt16LE(0, 32);
    header.writeUInt16LE(0, 34);
    header.writeUInt16LE(0, 36);
    header.writeUInt32LE(0, 38);
    header.writeUInt32LE(offset, 42);
    central.push(header, fileName);

    offset += local.length + fileName.length + data.length;
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

  return Buffer.concat([...locals, centralBuffer, end]);
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
