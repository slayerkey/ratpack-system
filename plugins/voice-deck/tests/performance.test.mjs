import assert from "node:assert/strict";
import test from "node:test";
import { normalizeRoster, pickSpotlight } from "../src/model.js";
import { renderKey } from "../src/render.js";

function member(index) {
  const id = String(index);
  return {
    user: { id, username: `User ${index}`, global_name: `User ${index}` },
    voice_state: { user_id: id, mute: index % 7 === 0, deaf: index % 13 === 0 },
  };
}

test("50-member rapid speaking/render stress stays bounded and deterministic", () => {
  const channel = { id: "c", name: "General", voice_states: Array.from({ length: 50 }, (_, index) => member(index + 1)) };
  const speaking = {};
  const started = performance.now();
  let final = "";

  for (let tick = 0; tick < 1500; tick += 1) {
    const id = String((tick % 50) + 1);
    speaking[id] = { active: tick % 3 !== 0, lastStartAt: tick, holdUntil: tick + 900 };
    const ordered = normalizeRoster(channel, speaking, "", "stable", tick + 1);
    const spotlight = pickSpotlight(ordered, tick + 1);
    const chosen = spotlight || ordered[0];
    const snapshot = { discord: { authenticated: true }, channel, members: ordered, speaking, voice: { mute: false, deaf: false }, account: null };
    final = renderKey("member", snapshot, { memberId: chosen.id, showAvatar: false }, { now: tick + 1 });
  }

  const elapsed = performance.now() - started;
  assert.match(final, /^data:image\/svg\+xml/);
  assert.ok(elapsed < 5000, `stress loop took ${elapsed.toFixed(1)} ms`);
});
