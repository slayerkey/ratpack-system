import { readFile } from "node:fs/promises";

function assert(condition, message) {
  if (!condition) throw new Error(`CS2 ship preflight failed: ${message}`);
}

const pro = JSON.parse(await readFile("../../cs2-competitive-dashboard-pro.json", "utf8"));
const lite = JSON.parse(await readFile("../../cs2-competitive-dashboard-lite.json", "utf8"));
const submission = JSON.parse(await readFile("submission.json", "utf8"));
const ratArt = await readFile("rat-art.ps1", "utf8");
const ratShip = await readFile("../../../tools/local/rat-ship-plugin.ps1", "utf8");

assert(pro.id === "cs2-competitive-dashboard-pro", "Pro registry slug changed unexpectedly");
assert(pro.type === "plugin", "Pro registry type must be plugin");
assert(pro.price_usd === 14.99, `Pro registry price must be 14.99, found ${pro.price_usd}`);
assert(pro.version === "0.1.0.0", `Pro registry version must be 0.1.0.0, found ${pro.version}`);
assert(pro.source === "products/cs2-competitive-dashboard/plugin", "Pro source must remain the shared plugin source");
assert(pro.ship_plugin_dir === "out/com.packrat.cs2-competitive-dashboard-pro.sdPlugin", "Pro must explicitly select the Pro deterministic build for Rat Ship");
assert(["BLOCKED_EXTERNAL", "READY_TO_SHIP"].includes(pro.workflow_state), `Pro workflow must fail closed or be explicitly ready, found ${pro.workflow_state}`);

assert(lite.workflow_state === "BLOCKED_STRATEGY_HOLD", `Lite must remain strategy-blocked, found ${lite.workflow_state}`);
assert(lite.marketplace_launch === "held", "Lite Marketplace launch must remain held");

assert(submission.slug === pro.id, `submission slug ${submission.slug} does not match ${pro.id}`);
assert(submission.name === pro.name, "submission name does not match Pro registry");
assert(submission.type === "plugin", "submission type must be plugin");
assert(submission.price_usd === pro.price_usd, "submission price does not match Pro registry");
assert(submission.version === pro.version, "submission version does not match Pro registry");
assert(submission.marketplace_auto_publish === false, "CS2 submission must never auto publish");
assert(Array.isArray(submission.marketplace_operating_systems) && submission.marketplace_operating_systems.includes("Windows"), "submission must declare Windows");
assert(Array.isArray(submission.marketplace_category) && submission.marketplace_category.includes("Gaming"), "submission must include Gaming category");
assert(/automatic|automatically/i.test(submission.description), "submission must explain automatic live setup");
assert(/localhost/i.test(submission.description), "submission must explain localhost live telemetry");
assert(/customer-owned|your own provider keys|your own provider/i.test(submission.description), "submission must explain customer-owned provider credentials");
assert(!/enable live cs2 tracking/i.test(submission.description), "submission must not describe the removed Enable Live Tracking flow");

const media = [
  "01_search_icon.png",
  "02_cover.png",
  "03_gallery_01.png",
  "04_gallery_02.png",
  "05_gallery_03.png",
  "06_gallery_04.png"
];
for (const name of media) assert(ratArt.includes(`\"${name}\"`), `Rat Art adapter does not produce ${name}`);
assert(ratArt.includes("render_profiles.py"), "Rat Art adapter must render the ready-profile gallery frame");

assert(ratShip.includes("ship_plugin_dir"), "global Rat Ship helper does not support explicit multi-flavor ship_plugin_dir");
assert(ratShip.includes("submission.json price_usd"), "global Rat Ship helper must fail on registry/submission price mismatch");
assert(ratShip.includes("submission.json version"), "global Rat Ship helper must fail on registry/submission version mismatch");

console.log("CS2 Rat Ship preflight OK: explicit Pro bundle, fail-closed workflow, submission metadata, and complete Marketplace media adapter passed.");
