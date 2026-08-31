import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

console.log("CS2 release promotion: proving the complete final release gate before changing workflow state...");
try {
  execFileSync(npmCommand, ["run", "release:final"], { stdio: "inherit" });
} catch (error) {
  const code = typeof error?.status === "number" ? error.status : 1;
  console.error("CS2 RELEASE PROMOTION: BLOCKED");
  console.error("release:final did not pass, so the Pro registry will not be changed.");
  process.exit(code || 1);
}

const proPath = "../../cs2-competitive-dashboard-pro.json";
const pro = JSON.parse(await readFile(proPath, "utf8"));

if (pro.id !== "cs2-competitive-dashboard-pro") {
  throw new Error(`CS2 release promotion refused: unexpected product id ${pro.id}`);
}
if (pro.price_usd !== 14.99) {
  throw new Error(`CS2 release promotion refused: expected $14.99, found ${pro.price_usd}`);
}
if (pro.workflow_state !== "BLOCKED" && pro.workflow_state !== "READY_TO_SHIP") {
  throw new Error(`CS2 release promotion refused: workflow_state=${pro.workflow_state}`);
}

if (pro.workflow_state === "READY_TO_SHIP") {
  console.log("CS2 Competitive Dashboard Pro is already READY_TO_SHIP.");
  process.exit(0);
}

pro.workflow_state = "READY_TO_SHIP";
pro.status = "qa_passed";
pro.marketplace_launch = "ready";
pro.blocker_kind = null;
pro.blocker = null;
pro.final_boundary = "Final release gate passed for the tested runtime fingerprint. Merge the release candidate to main, then use Rat Ship from canonical main.";
pro.release_promoted_at = new Date().toISOString();

await writeFile(proPath, `${JSON.stringify(pro, null, 2)}\n`, "utf8");
console.log("CS2 RELEASE PROMOTION: READY_TO_SHIP");
console.log(`Updated ${proPath}`);
console.log("Review/commit this registry change, merge the release candidate to main, then run Rat Ship from canonical main.");
