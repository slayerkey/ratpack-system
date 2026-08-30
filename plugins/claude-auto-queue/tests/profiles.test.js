import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve("com.packrat.claude-auto-queue.sdPlugin", "profiles");
const profiles = [
  "auto-queue-standard",
  "auto-queue-mini",
  "auto-queue-xl",
  "auto-queue-plus",
  "auto-queue-neo"
];

for (const profile of profiles) {
  test(`bundled ${profile} profile is a deterministic Stream Deck archive`, async () => {
    const data = await readFile(path.join(root, `${profile}.streamDeckProfile`));
    assert.equal(data.readUInt32LE(0), 0x04034b50);
    const text = data.toString("utf8");
    assert.match(text, /\.sdProfile\/manifest\.json/);
    assert.match(text, /"Version": "1\.0"/);
    assert.match(text, /com\.packrat\.claude-auto-queue\.status/);
    assert.match(text, /com\.packrat\.claude-auto-queue\.queue-prompt/);
  });
}

test("standard profile includes the complete ready-made command center", async () => {
  const text = (await readFile(path.join(root, "auto-queue-standard.streamDeckProfile"))).toString("utf8");
  for (const label of [
    "RUN TESTS",
    "FIX ERRORS",
    "REVIEW CODE",
    "CONTINUE",
    "DOCUMENT",
    "COMMIT LOCAL",
    "VERIFY",
    "PLAN NEXT",
    "SUMMARIZE",
    "FINISH TASK"
  ]) {
    assert.match(text, new RegExp(label.replace(" ", "\\s")));
  }
  assert.match(text, /"operation": "remove-next"/);
  assert.match(text, /"operation": "rotate"/);
  assert.match(text, /"operation": "clear"/);
});
