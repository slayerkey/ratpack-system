import assert from "node:assert/strict";
import test from "node:test";
import { nextOnlineProfileRefreshDelay } from "../src/providers/config.js";

const MIN = 50 * 60 * 1000;
const MID = 60 * 60 * 1000;
const MAX = 70 * 60 * 1000;

test("provider background refresh stays inside the conservative jitter window", () => {
  assert.equal(nextOnlineProfileRefreshDelay(() => 0), MIN);
  assert.equal(nextOnlineProfileRefreshDelay(() => 0.5), MID);
  assert.equal(nextOnlineProfileRefreshDelay(() => 1), MAX);
});

test("provider jitter clamps unexpected random values", () => {
  assert.equal(nextOnlineProfileRefreshDelay(() => -1), MIN);
  assert.equal(nextOnlineProfileRefreshDelay(() => 2), MAX);
});
