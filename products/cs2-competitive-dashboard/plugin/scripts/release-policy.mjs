import { readFile, readdir } from "node:fs/promises";
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

const proPi = await readFile(path.join(proDir, "ui", "property-inspector.html"), "utf8");
const proPiJs = await readFile(path.join(proDir, "ui", "pi.js"), "utf8");
assert(proPi.includes('id="faceit-api-key"') && proPi.includes('type="password"'), "Pro must expose a masked customer FACEIT key field");
assert(proPi.includes('id="leetify-api-key"') && proPi.includes('type="password"'), "Pro must expose a masked customer Leetify key field");
assert(proPiJs.includes("https://developers.faceit.com/"), "Pro must link directly to FACEIT Developer Portal");
assert(proPiJs.includes("https://docs.faceit.com/getting-started/authentication/api-keys/"), "Pro must link to official FACEIT API key instructions");
assert(proPiJs.includes("https://leetify.com/app/developer"), "Pro must link directly to Leetify developer key page");
assert(proPi.includes("never sent to a PackRat server"), "Pro must explain local customer-key handling");
assert(proPi.includes("Data Provided by Leetify") || proPi.includes("leetify-provided-dark.svg"), "Pro must include Leetify attribution surface");
assert(proPi.includes("view-leetify"), "Pro must include View on Leetify link surface");

const runtime = await readFile("src/runtime.ts", "utf8");
const directClient = await readFile("src/providers/direct-client.ts", "utf8");
const providerConfig = await readFile("src/providers/config.ts", "utf8");
assert(runtime.includes("faceitApiKey") && runtime.includes("leetifyApiKey"), "Pro runtime must support customer-owned provider keys");
assert(directClient.includes("open.faceit.com/data/v4") && directClient.includes("api-public.cs-prod.leetify.com"), "Provider client must call the official provider origins directly");
assert(!runtime.includes("GatewayClient") && !providerConfig.includes("PRO_GATEWAY_BASE_URL"), "PackRat shared provider gateway must remain disabled");

for (const dir of [proDir, liteDir]) {
  const files = await walk(dir);
  for (const file of files.filter((file) => /\.(?:js|json|html|css)$/i.test(file))) {
    const content = await readFile(file, "utf8");
    for (const forbiddenSecret of ["FACEIT_API_KEY=", "LEETIFY_API_KEY=", "STEAM_WEB_API_KEY=", "CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"]) {
      assert(!content.includes(forbiddenSecret), `${path.basename(dir)} unexpectedly contains PackRat infrastructure secret material`);
    }
  }
}

console.log("Release policy OK: Pro/Lite feature gates and customer-owned provider key architecture passed.");

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
