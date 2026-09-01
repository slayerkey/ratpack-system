import assert from "node:assert/strict";
import test from "node:test";
import { KeyImageUpdateQueue } from "../src/render/key-update-queue.js";
import { clampValue, fitValue, measureEm, VALUE_MAX_WIDTH } from "../src/render/key-svg.js";

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
  // Real CS2 values that previously overflowed the 124px inner panel because the old
  // fit was based on character count instead of glyph width.
  const samples = [
    "WAITING",
    "MIRAGE",
    "ANCIENT",
    "OVERPASS",
    "AK-47",
    "DESERT EAGLE",
    "M4A1 SILENCER",
    "VERY LONG MAP NAME",
    "EXTREMELY LONG WORKSHOP MAP NAME"
  ];

  for (const sample of samples) {
    const size = fitValue(sample);
    const shown = clampValue(sample, size);
    assert.ok(
      measureEm(shown) * size <= VALUE_MAX_WIDTH,
      `${sample} renders ${(measureEm(shown) * size).toFixed(1)}px at size ${size} and would clip`
    );
  }
});

test("short values keep the large key font and are never truncated", () => {
  for (const sample of ["100", "13-9", "0.00", "24"]) {
    assert.equal(fitValue(sample), 40);
    assert.equal(clampValue(sample, 40), sample);
  }
});

test("wide glyphs shrink further than narrow glyphs of the same length", () => {
  // "WAITING" and "1111111" are both seven characters; only the wide one must shrink.
  assert.ok(fitValue("WAITING") < fitValue("1111111"));
});
