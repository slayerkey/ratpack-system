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

validateProfileRegistrations(proManifest, "pro");
validateProfileRegistrations(liteManifest, "lite");
await validateProfileArchives(proDir, proManifest, "pro");
await validateProfileArchives(liteDir, liteManifest, "lite");

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

console.log("Release policy OK: Pro/Lite feature gates, bundled profiles, and customer-owned provider key architecture passed.");

function validateProfileRegistrations(manifest, flavor) {
  const profiles = manifest.Profiles ?? [];
  const expectedDeviceTypes = [0, 1, 2, 7, 9];
  const expectedCount = flavor === "pro" ? expectedDeviceTypes.length * 2 : expectedDeviceTypes.length;
  assert(profiles.length === expectedCount, `${flavor} profile registration count ${profiles.length} != ${expectedCount}`);

  for (const deviceType of expectedDeviceTypes) {
    const matching = profiles.filter((profile) => profile.DeviceType === deviceType);
    const expectedForDevice = flavor === "pro" ? 2 : 1;
    assert(matching.length === expectedForDevice, `${flavor} DeviceType ${deviceType} profile count ${matching.length} != ${expectedForDevice}`);
  }

  for (const profile of profiles) {
    assert(profile.AutoInstall === true, `${flavor} profile ${profile.Name} must auto install`);
    assert(profile.DontAutoSwitchWhenInstalled === true, `${flavor} profile ${profile.Name} must not hijack the active profile`);
    assert(profile.Readonly === false, `${flavor} profile ${profile.Name} must remain editable`);
    assert(typeof profile.Name === "string" && profile.Name.startsWith("profiles/"), `${flavor} profile path must live under profiles/`);
    if (flavor === "pro") {
      assert(profile.Name.includes("-competitive-") || profile.Name.includes("-live-"), `Pro profile ${profile.Name} must declare competitive or live layout`);
    } else {
      assert(profile.Name.includes("-starter-"), `Lite profile ${profile.Name} must be the starter layout`);
    }
  }
}

async function validateProfileArchives(root, manifest, flavor) {
  const allowedLiteMetrics = new Set(["score", "health", "money", "map"]);
  for (const registration of manifest.Profiles ?? []) {
    const file = path.join(root, `${registration.Name}.streamDeckProfile`);
    const entries = readStoredZip(await readFile(file));
    const rootManifestEntry = [...entries.keys()].find((name) => /\.sdProfile\/manifest\.json$/.test(name) && !name.includes("/Profiles/"));
    const pageManifestEntry = [...entries.keys()].find((name) => /\.sdProfile\/Profiles\/[^/]+\/manifest\.json$/.test(name));
    assert(rootManifestEntry, `${flavor} profile ${registration.Name} missing root manifest`);
    assert(pageManifestEntry, `${flavor} profile ${registration.Name} missing page manifest`);

    const rootManifest = JSON.parse(entries.get(rootManifestEntry).toString("utf8"));
    const pageManifest = JSON.parse(entries.get(pageManifestEntry).toString("utf8"));
    assert(rootManifest.Version === "2.0", `${flavor} profile ${registration.Name} must use profile format 2.0`);
    assert(Array.isArray(rootManifest.Pages?.Pages) && rootManifest.Pages.Pages.length === 1, `${flavor} profile ${registration.Name} must contain one deterministic page`);

    const controller = pageManifest.Controllers?.find((candidate) => candidate.Type === "Keypad");
    assert(controller, `${flavor} profile ${registration.Name} missing Keypad controller`);
    const actions = Object.values(controller.Actions ?? {});
    assert(actions.length > 0, `${flavor} profile ${registration.Name} must contain actions`);

    for (const action of actions) {
      assert(action.UUID?.startsWith(`com.packrat.cs2-competitive-dashboard-${flavor}.`), `${flavor} profile ${registration.Name} contains foreign action ${action.UUID}`);
      if (flavor === "lite") {
        const family = action.UUID.split(".").at(-1);
        assert(family === "live" || family === "status", `Lite profile ${registration.Name} exposes Pro family ${family}`);
        if (family === "live") assert(allowedLiteMetrics.has(action.Settings?.metric), `Lite profile ${registration.Name} exposes Pro metric ${action.Settings?.metric}`);
      }
    }

    if (flavor === "pro" && registration.Name.includes("-competitive-")) {
      assert(actions.some((action) => action.UUID.endsWith(".competitive")), `Pro competitive profile ${registration.Name} missing Competitive action`);
      assert(actions.some((action) => action.UUID.endsWith(".faceit")), `Pro competitive profile ${registration.Name} missing FACEIT action`);
    }
    if (flavor === "pro" && registration.Name.includes("-live-")) {
      assert(actions.some((action) => action.UUID.endsWith(".live")), `Pro live profile ${registration.Name} missing Live action`);
      assert(actions.some((action) => action.UUID.endsWith(".status")), `Pro live profile ${registration.Name} missing Status action`);
    }
  }
}

function readStoredZip(buffer) {
  const entries = new Map();
  let offset = 0;
  while (offset + 4 <= buffer.length && buffer.readUInt32LE(offset) === 0x04034b50) {
    const compression = buffer.readUInt16LE(offset + 8);
    const size = buffer.readUInt32LE(offset + 18);
    const nameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    assert(compression === 0, "Bundled profile ZIP entries must use deterministic store mode");
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLength + extraLength;
    const name = buffer.subarray(nameStart, nameStart + nameLength).toString("utf8");
    entries.set(name, buffer.subarray(dataStart, dataStart + size));
    offset = dataStart + size;
  }
  assert(entries.size >= 2, "Bundled profile archive did not expose expected local ZIP entries");
  return entries;
}

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
