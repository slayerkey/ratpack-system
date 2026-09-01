import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const PRODUCT_BRANCH = "product/cs2-competitive-dashboard";
const REMOTE_PRODUCT_REF = `origin/${PRODUCT_BRANCH}`;
const PRO_RELATIVE_PATH = "products/cs2-competitive-dashboard-pro.json";

function run(command, args, options = {}) {
  return execFileSync(command, args, options);
}

function output(command, args, cwd) {
  return run(command, args, { cwd, encoding: "utf8" }).trim();
}

function runReleaseFinal() {
  if (process.platform === "win32") {
    const shell = process.env.ComSpec || "cmd.exe";
    run(shell, ["/d", "/s", "/c", "npm run release:final"], { stdio: "inherit" });
    return;
  }
  run("npm", ["run", "release:final"], { stdio: "inherit" });
}

const repoRoot = output("git", ["rev-parse", "--show-toplevel"], process.cwd());

console.log("CS2 release promotion: validating candidate branch identity...");
run("git", ["fetch", "--prune", "origin"], { cwd: repoRoot, stdio: "inherit" });

const headBefore = output("git", ["rev-parse", "HEAD"], repoRoot);
const remoteHead = output("git", ["rev-parse", REMOTE_PRODUCT_REF], repoRoot);
if (headBefore !== remoteHead) {
  throw new Error(
    `CS2 release promotion refused: tested HEAD ${headBefore} does not match current ${REMOTE_PRODUCT_REF} ${remoteHead}. ` +
    "Run rat dev cs2-competitive-dashboard again, confirm the refreshed candidate, and rerun the final release flow."
  );
}

const trackedBefore = output("git", ["status", "--porcelain", "--untracked-files=no"], repoRoot);
if (trackedBefore) {
  throw new Error(`CS2 release promotion refused: tracked worktree changes exist before promotion:\n${trackedBefore}`);
}

console.log("CS2 release promotion: proving the complete final release gate...");
try {
  runReleaseFinal();
} catch (error) {
  const code = typeof error?.status === "number" ? error.status : 1;
  console.error("CS2 RELEASE PROMOTION: BLOCKED");
  console.error("release:final did not pass, so no registry commit or push was attempted.");
  process.exit(code || 1);
}

const trackedAfterGate = output("git", ["status", "--porcelain", "--untracked-files=no"], repoRoot);
if (trackedAfterGate) {
  throw new Error(`CS2 release promotion refused: release:final changed tracked files unexpectedly:\n${trackedAfterGate}`);
}

const proPath = path.join(repoRoot, PRO_RELATIVE_PATH);
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
  console.log("CS2 Competitive Dashboard Pro is already READY_TO_SHIP on the tested branch head.");
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
run("git", ["add", "--", PRO_RELATIVE_PATH], { cwd: repoRoot, stdio: "inherit" });
run("git", ["diff", "--cached", "--check"], { cwd: repoRoot, stdio: "inherit" });

const staged = output("git", ["diff", "--cached", "--name-only"], repoRoot)
  .split(/\r?\n/)
  .filter(Boolean);
if (staged.length !== 1 || staged[0].replaceAll("\\", "/") !== PRO_RELATIVE_PATH) {
  throw new Error(`CS2 release promotion refused: expected only ${PRO_RELATIVE_PATH} staged, found ${staged.join(", ") || "nothing"}`);
}

run("git", ["commit", "-m", "Promote CS2 Competitive Dashboard Pro to READY_TO_SHIP"], { cwd: repoRoot, stdio: "inherit" });
const promotionCommit = output("git", ["rev-parse", "HEAD"], repoRoot);

try {
  run("git", ["push", "origin", `HEAD:refs/heads/${PRODUCT_BRANCH}`], { cwd: repoRoot, stdio: "inherit" });
} catch {
  console.error("CS2 RELEASE PROMOTION: LOCAL COMMIT CREATED BUT PUSH FAILED");
  console.error(`Promotion commit preserved locally: ${promotionCommit}`);
  console.error(`Retry only after checking remote branch state: git -C \"${repoRoot}\" fetch origin`);
  console.error(`Safe push target: git -C \"${repoRoot}\" push origin ${promotionCommit}:refs/heads/${PRODUCT_BRANCH}`);
  process.exit(1);
}

console.log("CS2 RELEASE PROMOTION: READY_TO_SHIP");
console.log(`Promotion commit: ${promotionCommit}`);
console.log(`Pushed normally to origin/${PRODUCT_BRANCH} without force.`);
console.log("PR #29 can now be merged to main. After merge, run rat main and ship from canonical main.");
