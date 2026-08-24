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
  session.ingest(live({ roundNumber: 0, roundTotalDamage: 100, roundHeadshotKills: 1, kills: 1 }));
  const metrics = session.ingest(live({ roundNumber: 1, roundTotalDamage: 60, roundHeadshotKills: 0, kills: 2, deaths: 1 }));
  assert.equal(metrics.damage, 160);
  assert.equal(metrics.rounds, 2);
  assert.equal(metrics.kd, 2);
  assert.equal(metrics.adr, 80);
  assert.equal(metrics.hsPercent, 50);
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
