import { deflateSync } from "node:zlib";
import { access, copyFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { builds } from "./builds.mjs";
import { generateBundledProfiles } from "./profiles.mjs";

const SUPPORT_URL = "https://discord.gg/Fp6jUAtyas";
const LEETIFY_ATTRIBUTION = "static/ui/leetify-provided-dark.svg";
const HOST_LOG = "%APPDATA%\\PackRat\\CS2CompetitiveDashboard\\logs\\cs2-competitive-dashboard.log";

for (const build of builds) {
  await mkdir(path.join(build.output, "bin"), { recursive: true });
  await mkdir(path.join(build.output, "ui"), { recursive: true });
  await mkdir(path.join(build.output, "imgs", "actions"), { recursive: true });

  await copyFile("static/ui/property-inspector.html", path.join(build.output, "ui", "property-inspector.html"));
  await copyFile("static/ui/pi.js", path.join(build.output, "ui", "pi.js"));
  await copyFile("static/ui/diagnostics.js", path.join(build.output, "ui", "diagnostics.js"));
  await copyFile("static/ui/theme.css", path.join(build.output, "ui", "theme.css"));
  if (build.flavor === "pro" && await exists(LEETIFY_ATTRIBUTION)) {
    await copyFile(LEETIFY_ATTRIBUTION, path.join(build.output, "ui", "leetify-provided-dark.svg"));
  }
  await writeFile(
    path.join(build.output, "ui", "build-config.js"),
    `window.PACKRAT_BUILD = ${JSON.stringify({
      flavor: build.flavor,
      name: build.name,
      footerLabel: build.footerLabel,
      footerUrl: build.footerUrl,
      liveMetrics: build.liveMetrics ?? [],
      sessionMetrics: build.sessionMetrics ?? [],
      competitiveMetrics: build.competitiveMetrics ?? [],
      faceitMetrics: build.faceitMetrics ?? []
    })};\n`,
    "utf8"
  );

  const profiles = await generateBundledProfiles(build);
  await writeFile(path.join(build.output, "manifest.json"), `${JSON.stringify(createManifest(build, profiles), null, 2)}\n`, "utf8");
  await writeFile(path.join(build.output, ".sdignore"), "logs/\n*.map\n", "utf8");
  await generateImages(build);
}

console.log(`Host diagnostics after install: ${HOST_LOG}`);

function createManifest(build, profiles) {
  return {
    $schema: "https://schemas.elgato.com/streamdeck/plugins/manifest.json",
    Actions: build.actions.map((action) => ({
      Name: action.name,
      UUID: `${build.uuid}.${action.id}`,
      Icon: `imgs/actions/${action.id}/icon`,
      Tooltip: action.tooltip,
      Controllers: ["Keypad"],
      States: [
        {
          Image: `imgs/actions/${action.id}/key`,
          ShowTitle: false,
          TitleAlignment: "middle"
        }
      ]
    })),
    ApplicationsToMonitor: { windows: ["cs2.exe"] },
    Author: "PackRat",
    Category: build.name,
    CategoryIcon: "imgs/category",
    CodePath: "bin/plugin.js",
    Description: build.flavor === "pro"
      ? "A live CS2 competitive dashboard for Stream Deck with match telemetry, session performance, Premier and Competitive rank views, FACEIT stats, and ready-to-use profiles."
      : "A lightweight live CS2 dashboard for Stream Deck with Score, Health, Money, Map, connection status, and a ready-to-use starter profile.",
    Icon: "imgs/plugin",
    Name: build.name,
    Nodejs: { Version: "20", Debug: "enabled" },
    OS: [{ Platform: "windows", MinimumVersion: "10" }],
    Profiles: profiles,
    PropertyInspectorPath: "ui/property-inspector.html",
    SDKVersion: 3,
    Software: { MinimumVersion: "6.9" },
    SupportURL: SUPPORT_URL,
    URL: build.footerUrl,
    UUID: build.uuid,
    Version: "0.1.0.0"
  };
}

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

async function generateImages(build) {
  const imgs = path.join(build.output, "imgs");
  await mkdir(imgs, { recursive: true });
  await writeFile(path.join(imgs, "plugin.png"), createPluginPng(256));
  await writeFile(path.join(imgs, "plugin@2x.png"), createPluginPng(512));
  await writeFile(path.join(imgs, "category.svg"), actionIconSvg());

  for (const action of build.actions) {
    const dir = path.join(imgs, "actions", action.id);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "icon.svg"), actionIconSvg());
    await writeFile(path.join(dir, "key.svg"), defaultKeySvg(action.name));
  }
}

function actionIconSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><g fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round"><circle cx="20" cy="20" r="11"/><path d="M20 4v7M20 29v7M4 20h7M29 20h7"/></g><circle cx="20" cy="20" r="3" fill="#FFFFFF"/></svg>`;
}

function defaultKeySvg(label) {
  const names = {
    "Live Metric": "LIVE",
    "Session Metric": "SESSION",
    "Competitive Metric": "RANK",
    "FACEIT Metric": "FACEIT",
    "CS2 Status": "STATUS"
  };
  const short = names[label] ?? "CS2";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144"><rect width="144" height="144" rx="18" fill="#0B0F0D"/><rect x="10" y="10" width="124" height="124" rx="14" fill="#101713" stroke="#1D2A23" stroke-width="2"/><circle cx="72" cy="57" r="18" fill="none" stroke="#2BE86A" stroke-width="4"/><path d="M72 29v12M72 73v12M44 57h12M88 57h12" stroke="#2BE86A" stroke-width="4" stroke-linecap="round"/><text x="72" y="112" text-anchor="middle" fill="#F4F8F6" font-family="Arial,sans-serif" font-size="13" font-weight="700">${short}</text></svg>`;
}

function createPluginPng(size) {
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y += 1) {
    const row = y * stride;
    raw[row] = 0;
    for (let x = 0; x < size; x += 1) {
      const nx = (x + 0.5) / size;
      const ny = (y + 0.5) / size;
      const dx = nx - 0.5;
      const dy = ny - 0.5;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const ring = Math.abs(distance - 0.25) < 0.022;
      const cross = (Math.abs(dx) < 0.018 && Math.abs(dy) < 0.34) || (Math.abs(dy) < 0.018 && Math.abs(dx) < 0.34);
      const center = distance < 0.055;
      const accent = ring || cross || center;
      const offset = row + 1 + x * 4;
      raw[offset] = accent ? 43 : 11;
      raw[offset + 1] = accent ? 232 : 15;
      raw[offset + 2] = accent ? 106 : 13;
      raw[offset + 3] = 255;
    }
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([signature, pngChunk("IHDR", ihdr), pngChunk("IDAT", deflateSync(raw)), pngChunk("IEND", Buffer.alloc(0))]);
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}
