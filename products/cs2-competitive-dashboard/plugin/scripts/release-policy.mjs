import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";

const proDir = "out/com.packrat.cs2-competitive-dashboard-pro.sdPlugin";
const liteDir = "out/com.packrat.cs2-competitive-dashboard-lite.sdPlugin";
const proManifest = JSON.parse(await readFile(path.join(proDir, "manifest.json"), "utf8"));
const liteManifest = JSON.parse(await readFile(path.join(liteDir, "manifest.json"), "utf8"));

const expectedProActions = ["live", "session", "competitive", "faceit", "status"].map((id) => `com.packrat.cs2-competitive-dashboard-pro.${id}`);
const expectedLiteActions = ["live", "status"].map((id) => `com.packrat.cs2-competitive-dashboard-lite.${id}`);

assertEqualSet(proManifest.Actions.map((action) => action.UUID), expectedProActions, "Pro action surface");
assertEqualSet(liteManifest.Actions.map((action) => action.UUID), expectedLiteActions, "Lite action surface");

const liteConfig = await readFile(path.join(liteDir, "ui", "build-config.js"), "utf8");
for (const metric of ["score", "health", "money", "map"]) assert(liteConfig.includes(`\"${metric}\"`), `Lite missing allowed metric ${metric}`);
for (const forbidden of ["kills", "deaths", "adr", "hs", "record", "premier", "current-map-rank", "elo", "recent-record"]) {
  assert(!liteConfig.includes(`\"${forbidden}\"`), `Lite build config exposes Pro-only metric ${forbidden}`);
}
assert(liteConfig.includes('"competitiveMetrics":[]'), "Lite competitive metrics must be empty");
assert(liteConfig.includes('"faceitMetrics":[]'), "Lite FACEIT metrics must be empty");
assert(liteConfig.includes('"sessionMetrics":[]'), "Lite session metrics must be empty");

const proConfig = await readFile(path.join(proDir, "ui", "build-config.js"), "utf8");
for (const required of ["premier", "current-map-rank", "elo", "recent-record"]) assert(proConfig.includes(`\"${required}\"`), `Pro missing online metric ${required}`);

const providerConfig = await readFile("src/providers/config.ts", "utf8");
const gatewayMatch = providerConfig.match(/PRO_GATEWAY_BASE_URL\s*=\s*\"([^\"]*)\"/);
assert(gatewayMatch, "Could not inspect PRO_GATEWAY_BASE_URL");
if (gatewayMatch[1]) {
  await access("static/ui/leetify-provided-dark.svg");
  await access(path.join(proDir, "ui", "leetify-provided-dark.svg"));
  const pi = await readFile(path.join(proDir, "ui", "property-inspector.html"), "utf8");
  assert(pi.includes("leetify-provided-dark.svg"), "Live Leetify builds must render the official unmodified attribution asset");
  assert(pi.includes("view-leetify"), "Live Leetify builds must include View on Leetify");
}

for (const dir of [proDir, liteDir]) {
  const files = await walk(dir);
  for (const file of files.filter((file) => /\.(?:js|json|html|css)$/i.test(file))) {
    const content = await readFile(file, "utf8");
    for (const secretName of ["FACEIT_API_KEY", "LEETIFY_API_KEY", "STEAM_WEB_API_KEY"]) {
      assert(!content.includes(secretName), `${path.basename(dir)} unexpectedly contains server secret name ${secretName}`);
    }
  }
}

console.log("Release policy OK: Pro/Lite feature gates, provider safety, and attribution guard passed.");

function assert(condition, message) {
  if (!condition) throw new Error(`Release policy failed: ${message}`);
}

function assertEqualSet(actual, expected, label) {
  const a = [...actual].sort();
  const e = [...expected].sort();
  assert(JSON.stringify(a) === JSON.stringify(e), `${label} mismatch: ${JSON.stringify(a)} != ${JSON.stringify(e)}`);
}

async function walk(root) {
  const output = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) output.push(...await walk(full));
    else output.push(full);
  }
  return output;
}
