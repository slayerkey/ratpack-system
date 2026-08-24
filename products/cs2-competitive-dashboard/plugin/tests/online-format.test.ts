import assert from "node:assert/strict";
import test from "node:test";
import { competitiveDisplay, faceitDisplay } from "../src/actions/online-format.js";
import { emptyOnlineSnapshot, type OnlineProfileSnapshot } from "../src/providers/types.js";

function ready(): OnlineProfileSnapshot {
  return {
    requestedIdentity: "76561198000000000",
    steamId64: "76561198000000000",
    refreshing: false,
    leetify: {
      status: "ready",
      premier: 14832,
      winRate: 0.54,
      totalMatches: 50,
      competitiveRanks: [
        { mapName: "de_mirage", rank: 12, rankLabel: "Master Guardian II" },
        { mapName: "de_nuke", rank: 18, rankLabel: "Global Elite" }
      ],
      recentMatches: [{ id: "l1", source: "matchmaking", mapName: "de_mirage", outcome: "win", score: "13-8", rating: 0.41 }]
    },
    faceit: {
      status: "ready",
      nickname: "Rat",
      elo: 1743,
      level: 8,
      region: "EU",
      kd: 1.21,
      hsPercent: 48,
      winRate: 53,
      recentRecord: { wins: 3, losses: 2 },
      recentMatches: [{ id: "f1", source: "faceit", mapName: "", outcome: "WIN", score: "13-9" }]
    }
  };
}

test("competitive actions use current GSI map and provider rank labels", () => {
  const online = ready();
  assert.deepEqual(competitiveDisplay("premier", online), { label: "PREMIER", value: "14,832", subtitle: "CS RATING" });
  assert.equal(competitiveDisplay("current-map-rank", online, "de_mirage").value, "Master Guardian II");
  assert.equal(competitiveDisplay("best-map-rank", online).value, "Global Elite");
  assert.equal(competitiveDisplay("recent-result", online).value, "WIN");
  assert.equal(competitiveDisplay("win-rate", online).value, "54%");
  assert.equal(competitiveDisplay("leetify-rating", online).value, "0.41");
});

test("FACEIT actions expose normalized provider metrics", () => {
  const online = ready();
  assert.equal(faceitDisplay("elo", online).value, "1,743");
  assert.equal(faceitDisplay("level", online).value, "LEVEL 8");
  assert.equal(faceitDisplay("kd", online).value, "1.21");
  assert.equal(faceitDisplay("hs", online).value, "48%");
  assert.equal(faceitDisplay("recent-record", online).value, "3W 2L");
  assert.equal(faceitDisplay("recent-match", online).subtitle, "-- 13-9");
});

test("provider failures always render actionable nonblank states", () => {
  const online = emptyOnlineSnapshot("76561198000000000");
  online.leetify.status = "not_found";
  online.faceit.status = "rate_limited";
  assert.equal(competitiveDisplay("premier", online).value, "NOT FOUND");
  assert.equal(faceitDisplay("elo", online).value, "LIMITED");

  const empty = emptyOnlineSnapshot();
  assert.equal(competitiveDisplay("premier", empty).value, "SETUP");
  assert.equal(faceitDisplay("elo", empty).value, "SETUP");
});
