import assert from "node:assert/strict";
import test from "node:test";
import { initials, normalizeAccent, normalizeRoster, pickSpotlight, speakingCount, truncate } from "../src/model.js";

function member(id, name, voice = {}) {
  return { user: { id, username: name, global_name: name, avatar: null }, voice_state: { user_id: id, ...voice } };
}

test("stable roster keeps physical order while placing self first", () => {
  const channel = { voice_states: [member("a", "Alpha"), member("self", "Me"), member("b", "Bravo")] };
  const speaking = { b: { active: true, lastStartAt: 100, holdUntil: 1000 } };
  const roster = normalizeRoster(channel, speaking, "self", "stable", 200);
  assert.deepEqual(roster.map((m) => m.id), ["self", "a", "b"]);
});

test("speaking-first is opt-in and still keeps self pinned first", () => {
  const channel = { voice_states: [member("a", "Alpha"), member("self", "Me"), member("b", "Bravo")] };
  const speaking = { b: { active: true, lastStartAt: 100, holdUntil: 1000 } };
  const roster = normalizeRoster(channel, speaking, "self", "speaking-first", 200);
  assert.deepEqual(roster.map((m) => m.id), ["self", "b", "a"]);
});

test("speaker spotlight uses most recently active speaker and hold window", () => {
  const list = [
    { id: "a", speaking: true, lastSpokeAt: 100, holdUntil: 1000 },
    { id: "b", speaking: true, lastSpokeAt: 200, holdUntil: 1000 },
  ];
  assert.equal(pickSpotlight(list, 300).id, "b");
  const held = [
    { id: "a", speaking: false, lastSpokeAt: 100, holdUntil: 800 },
    { id: "b", speaking: false, lastSpokeAt: 200, holdUntil: 900 },
  ];
  assert.equal(pickSpotlight(held, 850).id, "b");
  assert.equal(pickSpotlight(held, 901), null);
});

test("50-member roster survives normalization without duplicates", () => {
  const voice_states = Array.from({ length: 50 }, (_, i) => member(String(i), `Player ${i}`));
  const roster = normalizeRoster({ voice_states }, {}, "17", "stable", 0);
  assert.equal(roster.length, 50);
  assert.equal(roster[0].id, "17");
  assert.equal(new Set(roster.map((m) => m.id)).size, 50);
  assert.equal(speakingCount(roster), 0);
});

test("Unicode names, initials, truncation and accent sanitation are deterministic", () => {
  assert.equal(initials("🌙 月"), "🌙月");
  assert.equal(truncate("A very long display name", 10), "A very lo…");
  assert.equal(normalizeAccent("#abcdef"), "#ABCDEF");
  assert.equal(normalizeAccent("javascript:bad"), "#2BE86A");
});
