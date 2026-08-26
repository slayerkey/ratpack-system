import assert from "node:assert/strict";
import test from "node:test";
import { KeyImageUpdateQueue } from "../src/render/key-update-queue.js";
import { fitValue } from "../src/render/key-svg.js";

test("key image queue coalesces pending values and skips unchanged images", async () => {
  const sent: string[] = [];
  const errors: unknown[] = [];
  const queue = new KeyImageUpdateQueue((_family, error) => errors.push(error));
  const action = {
    async setImage(image: string): Promise<void> {
      sent.push(image);
    }
  };

  queue.request(action, "A", "live");
  queue.request(action, "B", "live");
  queue.request(action, "C", "live");
  await queue.waitForIdle();

  assert.deepEqual(sent, ["C"]);
  assert.equal(errors.length, 0);

  queue.request(action, "C", "live");
  await queue.waitForIdle();
  assert.deepEqual(sent, ["C"]);

  queue.request(action, "D", "live");
  await queue.waitForIdle();
  assert.deepEqual(sent, ["C", "D"]);
});

test("key image queue contains Stream Deck timeouts instead of rejecting globally", async () => {
  const errors: unknown[] = [];
  let attempts = 0;
  const queue = new KeyImageUpdateQueue((_family, error) => errors.push(error));
  const action = {
    async setImage(): Promise<void> {
      attempts += 1;
      if (attempts === 1) throw new Error("The request timed out");
    }
  };

  queue.request(action, "LIVE-1", "live");
  await queue.waitForIdle();
  assert.equal(attempts, 1);
  assert.equal(errors.length, 1);

  queue.request(action, "LIVE-1", "live");
  await queue.waitForIdle();
  assert.equal(attempts, 2);
});

test("long map and weapon values progressively shrink to stay on a key", () => {
  assert.equal(fitValue("MIRAGE"), 33);
  assert.equal(fitValue("OVERPASS"), 27);
  assert.equal(fitValue("DESERT EAGLE"), 23);
  assert.equal(fitValue("M4A1 SILENCER"), 20);
  assert.equal(fitValue("VERY LONG MAP NAME"), 18);
  assert.equal(fitValue("EXTREMELY LONG WORKSHOP MAP NAME"), 16);
});
