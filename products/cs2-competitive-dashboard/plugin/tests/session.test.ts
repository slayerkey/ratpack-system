import assert from "node:assert/strict";
import test from "node:test";
import type { LiveState } from "../src/core/types.js";
import { SessionTracker } from "../src/session/session-tracker.js";

function live(overrides: Partial<LiveState> = {}): LiveState {
  return {
    receivedAt: 0,
    playerTeam: "CT",
    mapPhase: "live",
    roundNumber: 0,
    ctScore: 0,
    tScore: 0,
    roundKills: 0,
    roundHeadshotKills: 0,
    roundTotalDamage: 0,
    kills: 0,
    deaths: 0,
    assists: 0,
    mvps: 0,
    score: 0,
    weapons: [],
    ...overrides
  };
}

test("tracks damage, headshots and live derived metrics across rounds", () => {
  const session = new SessionTracker();
  session.ingest(live({ roundNumber: 0, roundTotalDamage: 100, roundHeadshotKills: 1, roundKills: 1, kills: 1 }));
  const metrics = session.ingest(live({ roundNumber: 1, roundTotalDamage: 60, roundHeadshotKills: 0, roundKills: 1, kills: 2, deaths: 1 }));
  assert.equal(metrics.damage, 160);
  assert.equal(metrics.rounds, 2);
  assert.equal(metrics.kd, 2);
  assert.equal(metrics.adr, 80);
  assert.equal(metrics.hsPercent, 50);
});

test("accumulates Deathmatch headshots across respawn counter resets", () => {
  const session = new SessionTracker();

  session.ingest(live({
    roundNumber: 0,
    roundKills: 1,
    roundHeadshotKills: 1,
    roundTotalDamage: 100,
    kills: 1,
    deaths: 0
  }));
  session.ingest(live({
    roundNumber: 0,
    roundKills: 2,
    roundHeadshotKills: 2,
    roundTotalDamage: 180,
    kills: 2,
    deaths: 0
  }));

  // Deathmatch respawn: map.round stays the same while player.state round
  // counters restart. The tracker must preserve the completed life segment.
  session.ingest(live({
    roundNumber: 0,
    roundKills: 0,
    roundHeadshotKills: 0,
    roundTotalDamage: 0,
    kills: 2,
    deaths: 1
  }));
  const metrics = session.ingest(live({
    roundNumber: 0,
    roundKills: 1,
    roundHeadshotKills: 1,
    roundTotalDamage: 90,
    kills: 3,
    deaths: 1
  }));

  assert.equal(metrics.headshotKills, 3);
  assert.equal(metrics.hsPercent, 100);
  assert.equal(metrics.damage, 270);
  assert.equal(metrics.rounds, 1);
});

test("detects a respawn reset even when the next packet already contains a kill", () => {
  const session = new SessionTracker();
  session.ingest(live({ roundKills: 2, roundHeadshotKills: 1, roundTotalDamage: 160, kills: 2 }));

  const metrics = session.ingest(live({
    roundKills: 1,
    roundHeadshotKills: 1,
    roundTotalDamage: 80,
    kills: 3,
    deaths: 1
  }));

  assert.equal(metrics.headshotKills, 2);
  assert.ok(Math.abs(metrics.hsPercent - (2 / 3) * 100) < 1e-9);
  assert.equal(metrics.damage, 240);
  assert.equal(metrics.rounds, 1);
});

test("uses a Deathmatch damage reset when kill and headshot counters repeat exactly", () => {
  const session = new SessionTracker();
  session.ingest(live({
    roundKills: 1,
    roundHeadshotKills: 1,
    roundTotalDamage: 110,
    kills: 1,
    deaths: 0
  }));

  const metrics = session.ingest(live({
    roundKills: 1,
    roundHeadshotKills: 1,
    roundTotalDamage: 70,
    kills: 2,
    deaths: 1
  }));

  assert.equal(metrics.headshotKills, 2);
  assert.equal(metrics.hsPercent, 100);
  assert.equal(metrics.damage, 180);
  assert.equal(metrics.rounds, 1);
});

test("finalizes a match once and starts a new match afterward", () => {
  const session = new SessionTracker();
  session.ingest(live({ roundNumber: 0, roundTotalDamage: 90, kills: 2, deaths: 1 }));
  let metrics = session.ingest(live({ mapPhase: "gameover", roundNumber: 0, ctScore: 13, tScore: 8, roundTotalDamage: 90, kills: 2, deaths: 1 }));
  assert.equal(metrics.matches, 1);
  assert.equal(metrics.wins, 1);
  assert.equal(metrics.losses, 0);
  session.ingest(live({ mapPhase: "gameover", roundNumber: 0, ctScore: 13, tScore: 8, kills: 2, deaths: 1 }));
  metrics = session.ingest(live({ mapPhase: "live", roundNumber: 0, playerTeam: "T", kills: 1 }));
  assert.equal(metrics.matches, 1);
  assert.equal(metrics.inMatch, true);
});

test("Deathmatch HS% stays accurate when a life reset is never observed", () => {
  const session = new SessionTracker();

  // Life 1: two kills, both headshots. Observed normally.
  session.ingest(live({ roundKills: 1, roundHeadshotKills: 1, roundTotalDamage: 100, kills: 1, deaths: 0 }));
  session.ingest(live({ roundKills: 2, roundHeadshotKills: 2, roundTotalDamage: 180, kills: 2, deaths: 0 }));

  // The player dies and respawns, but GSI never delivers a packet while the
  // per-life counters are back at zero. The next packet already shows a life
  // that has overtaken the previous one, so no counter decrease is visible.
  const metrics = session.ingest(live({
    roundKills: 3,
    roundHeadshotKills: 3,
    roundTotalDamage: 300,
    kills: 5,
    deaths: 1
  }));

  // Match total kills stay authoritative for the KILLS key.
  assert.equal(metrics.kills, 5);

  // HS% must divide headshots by the kills from the same observed window.
  // Mixing a reconstructed headshot count with the complete match kill total
  // is what made the physical deck report 65% while CS2 showed 81%.
  assert.equal(metrics.hsPercent, 100);
});

test("Deathmatch HS% reflects a genuine mix of headshot and body kills", () => {
  const session = new SessionTracker();

  // Life 1: two kills, one headshot.
  session.ingest(live({ roundKills: 1, roundHeadshotKills: 1, roundTotalDamage: 100, kills: 1, deaths: 0 }));
  session.ingest(live({ roundKills: 2, roundHeadshotKills: 1, roundTotalDamage: 190, kills: 2, deaths: 0 }));

  // Respawn observed cleanly, then life 2: two kills, one headshot.
  session.ingest(live({ roundKills: 0, roundHeadshotKills: 0, roundTotalDamage: 0, kills: 2, deaths: 1 }));
  session.ingest(live({ roundKills: 1, roundHeadshotKills: 1, roundTotalDamage: 95, kills: 3, deaths: 1 }));
  const metrics = session.ingest(live({ roundKills: 2, roundHeadshotKills: 1, roundTotalDamage: 200, kills: 4, deaths: 1 }));

  assert.equal(metrics.kills, 4);
  assert.equal(metrics.headshotKills, 2);
  assert.equal(metrics.hsPercent, 50);
});
