import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const INPUTS = [
  "src",
  "static/ui/property-inspector.html",
  "static/ui/pi.js",
  "static/ui/diagnostics.js",
  "static/ui/theme.css",
  "rollup.config.mjs",
  "package-lock.json",
  "scripts/assemble.mjs",
  "scripts/builds.mjs",
  "scripts/profiles.mjs",
  "scripts/apply-provider-attribution.mjs"
];

function filesUnder(entry) {
  const info = statSync(entry);
  if (info.isFile()) return [entry];
  const files = [];
  for (const child of readdirSync(entry).sort()) {
    files.push(...filesUnder(path.join(entry, child)));
  }
  return files;
}

export function releaseRuntimeFingerprint() {
  const hash = createHash("sha256");
  const files = INPUTS.flatMap(filesUnder).sort((a, b) => a.localeCompare(b));
  for (const file of files) {
    const normalized = file.replaceAll("\\", "/");
    hash.update(normalized);
    hash.update("\0");
    hash.update(readFileSync(file));
    hash.update("\0");
  }
  return hash.digest("hex");
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : undefined;
if (invokedPath && invokedPath === path.resolve(fileURLToPath(import.meta.url))) {
  console.log(releaseRuntimeFingerprint());
}
