import { readFile } from "node:fs/promises";
import path from "node:path";
import { releaseRuntimeFingerprint } from "./release-fingerprint.mjs";

const expectedFingerprint = releaseRuntimeFingerprint();
const builds = [
  {
    flavor: "pro",
    dir: "out/com.packrat.cs2-competitive-dashboard-pro.sdPlugin"
  },
  {
    flavor: "lite",
    dir: "out/com.packrat.cs2-competitive-dashboard-lite.sdPlugin"
  }
];

for (const build of builds) {
  const file = path.join(build.dir, "build-info.json");
  const info = JSON.parse(await readFile(file, "utf8"));
  assert(info.schema === 1, `${build.flavor} build-info schema must be 1`);
  assert(info.product === "cs2-competitive-dashboard", `${build.flavor} build-info product mismatch`);
  assert(info.flavor === build.flavor, `${build.flavor} build-info flavor mismatch: ${info.flavor}`);
  assert(info.version === "0.1.0.0", `${build.flavor} build-info version mismatch: ${info.version}`);
  assert(/^[a-f0-9]{64}$/.test(info.runtimeFingerprint ?? ""), `${build.flavor} build-info runtime fingerprint is missing/invalid`);
  assert(info.runtimeFingerprint === expectedFingerprint, `${build.flavor} built runtime fingerprint does not match current source`);
}

console.log(`CS2 build fingerprint policy PASS: Pro + Lite match ${expectedFingerprint}`);

function assert(condition, message) {
  if (!condition) throw new Error(`CS2 build fingerprint policy failed: ${message}`);
}
