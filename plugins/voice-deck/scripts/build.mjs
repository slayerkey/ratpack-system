import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const plugin = resolve(root, "com.packrat.voice-deck.sdPlugin");
const bin = resolve(plugin, "bin");
const imgs = resolve(plugin, "imgs");
const uiOut = resolve(plugin, "ui");

await rm(bin, { recursive: true, force: true });
await rm(imgs, { recursive: true, force: true });
await rm(uiOut, { recursive: true, force: true });
await mkdir(bin, { recursive: true });
await mkdir(imgs, { recursive: true });
await mkdir(uiOut, { recursive: true });
await cp(resolve(root, "ui", "inspector.html"), resolve(uiOut, "inspector.html"));
await cp(resolve(root, "ui", "inspector.css"), resolve(uiOut, "inspector.css"));
await cp(resolve(root, "ui", "inspector.js"), resolve(uiOut, "inspector.js"));

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const name = Buffer.from(type, "ascii");
  const body = Buffer.concat([name, data]);
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  name.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(body), 8 + data.length);
  return chunk;
}

function iconPng(size) {
  const pixels = Buffer.alloc(size * size * 4);
  const bg = [9, 11, 16, 255];
  const fg = [244, 246, 248, 255];
  const accent = [43, 232, 106, 255];
  for (let i = 0; i < pixels.length; i += 4) pixels.set(bg, i);
  const set = (x, y, color) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (Math.floor(y) * size + Math.floor(x)) * 4;
    pixels.set(color, i);
  };
  const circle = (cx, cy, r, color, stroke = 0) => {
    const r2 = r * r;
    const inner2 = Math.max(0, r - stroke) ** 2;
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y += 1) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x += 1) {
        const d = (x - cx) ** 2 + (y - cy) ** 2;
        if (d <= r2 && (!stroke || d >= inner2)) set(x, y, color);
      }
    }
  };
  const rect = (x0, y0, x1, y1, color) => {
    for (let y = Math.floor(y0); y <= Math.ceil(y1); y += 1) for (let x = Math.floor(x0); x <= Math.ceil(x1); x += 1) set(x, y, color);
  };
  const line = (x0, y0, x1, y1, width, color) => {
    const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0));
    for (let s = 0; s <= steps; s += 1) {
      const t = s / Math.max(1, steps);
      circle(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, width / 2, color);
    }
  };
  const s = size / 256;
  circle(128 * s, 124 * s, 78 * s, accent, 10 * s);
  rect(107 * s, 60 * s, 149 * s, 132 * s, fg);
  circle(128 * s, 60 * s, 21 * s, fg);
  circle(128 * s, 132 * s, 21 * s, fg);
  line(84 * s, 126 * s, 84 * s, 140 * s, 10 * s, fg);
  line(84 * s, 140 * s, 93 * s, 158 * s, 10 * s, fg);
  line(93 * s, 158 * s, 110 * s, 169 * s, 10 * s, fg);
  line(110 * s, 169 * s, 128 * s, 172 * s, 10 * s, fg);
  line(172 * s, 126 * s, 172 * s, 140 * s, 10 * s, fg);
  line(172 * s, 140 * s, 163 * s, 158 * s, 10 * s, fg);
  line(163 * s, 158 * s, 146 * s, 169 * s, 10 * s, fg);
  line(146 * s, 169 * s, 128 * s, 172 * s, 10 * s, fg);
  line(128 * s, 172 * s, 128 * s, 198 * s, 10 * s, fg);
  line(108 * s, 199 * s, 148 * s, 199 * s, 10 * s, fg);

  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    const row = y * (size * 4 + 1);
    raw[row] = 0;
    pixels.copy(raw, row + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([signature, pngChunk("IHDR", ihdr), pngChunk("IDAT", deflateSync(raw, { level: 9 })), pngChunk("IEND", Buffer.alloc(0))]);
}

const pluginDir = resolve(imgs, "plugin");
await mkdir(pluginDir, { recursive: true });
await writeFile(resolve(pluginDir, "icon.png"), iconPng(256));
await writeFile(resolve(pluginDir, "icon@2x.png"), iconPng(512));

const categoryDir = resolve(imgs, "category");
await mkdir(categoryDir, { recursive: true });
const category = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 28 28" fill="none"><circle cx="14" cy="13" r="9" stroke="#fff" stroke-width="2.4"/><rect x="11" y="6" width="6" height="11" rx="3" fill="#fff"/><path d="M9 14c0 4 2 6 5 6s5-2 5-6M14 20v4M11 24h6" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/></svg>`;
await writeFile(resolve(categoryDir, "icon.svg"), category(28));
await writeFile(resolve(categoryDir, "icon@2x.svg"), category(56));

const kinds = ["status", "mute", "deafen", "combined", "channel", "member", "member-slot", "spotlight", "activity", "count", "connection", "navigator"];
function glyph(kind, color = "#fff") {
  if (kind === "mute") return `<rect x="65" y="34" width="14" height="43" rx="7" fill="${color}"/><path d="M49 69c0 16 10 25 23 25s23-9 23-25M72 94v18M58 112h28" stroke="${color}" stroke-width="7" stroke-linecap="round" fill="none"/>`;
  if (kind === "deafen") return `<path d="M42 68v-8a30 30 0 0160 0v8" stroke="${color}" stroke-width="8" fill="none" stroke-linecap="round"/><rect x="34" y="66" width="19" height="40" rx="8" fill="${color}"/><rect x="91" y="66" width="19" height="40" rx="8" fill="${color}"/>`;
  if (kind === "combined") return `<circle cx="49" cy="72" r="23" stroke="${color}" stroke-width="7" fill="none"/><circle cx="95" cy="72" r="23" stroke="${color}" stroke-width="7" fill="none"/><path d="M72 47v50M47 72h50" stroke="${color}" stroke-width="7" stroke-linecap="round"/>`;
  if (["member", "member-slot", "spotlight"].includes(kind)) return `<circle cx="72" cy="54" r="25" stroke="${color}" stroke-width="7" fill="none"/><path d="M34 116c3-27 18-40 38-40s35 13 38 40" stroke="${color}" stroke-width="7" fill="none" stroke-linecap="round"/>`;
  if (kind === "activity") return `<circle cx="72" cy="72" r="12" fill="${color}"/><circle cx="72" cy="72" r="30" stroke="${color}" stroke-width="6" fill="none" opacity=".75"/><circle cx="72" cy="72" r="49" stroke="${color}" stroke-width="5" fill="none" opacity=".4"/>`;
  if (kind === "connection") return `<path d="M62 47l9-9a22 22 0 0131 31l-12 12a22 22 0 01-31 0M82 97l-9 9a22 22 0 01-31-31l12-12a22 22 0 0131 0M57 87l30-30" stroke="${color}" stroke-width="8" fill="none" stroke-linecap="round"/>`;
  if (kind === "navigator") return `<path d="M42 72h60M86 50l22 22-22 22M58 94L36 72l22-22" stroke="${color}" stroke-width="8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
  if (kind === "channel") return `<rect x="32" y="40" width="80" height="64" rx="15" stroke="${color}" stroke-width="7" fill="none"/><path d="M50 61h44M50 83h31" stroke="${color}" stroke-width="7" stroke-linecap="round"/>`;
  return `<circle cx="50" cy="66" r="21" stroke="${color}" stroke-width="7" fill="none"/><circle cx="94" cy="66" r="18" stroke="${color}" stroke-width="7" fill="none"/><path d="M24 116c2-22 13-32 26-32s24 10 26 32M72 116c2-18 11-27 22-27s20 9 22 27" stroke="${color}" stroke-width="7" fill="none" stroke-linecap="round"/>`;
}

for (const kind of kinds) {
  const dir = resolve(imgs, "actions", kind);
  await mkdir(dir, { recursive: true });
  const small = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 144 144">${glyph(kind)}</svg>`;
  const key = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 144 144"><rect width="144" height="144" rx="25" fill="#090B10"/>${glyph(kind, "#2BE86A")}</svg>`;
  await writeFile(resolve(dir, "icon.svg"), small(20));
  await writeFile(resolve(dir, "icon@2x.svg"), small(40));
  await writeFile(resolve(dir, "key.svg"), key(72));
  await writeFile(resolve(dir, "key@2x.svg"), key(144));
  if (kind === "navigator") {
    await writeFile(resolve(dir, "encoder.svg"), small(72));
    await writeFile(resolve(dir, "encoder@2x.svg"), small(144));
  }
}

await import("./build-profiles.mjs");
console.log("Built PackRat Voice Deck assets, UI and bundled profiles");
