import assert from "node:assert/strict";
import test from "node:test";
import { ProviderClient } from "../src/providers/direct-client.js";

const STEAM_ID = "76561198000000000";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

test("requires customer owned provider keys without using a shared gateway", async () => {
  const client = new ProviderClient(async () => {
    throw new Error("provider fetch should not run without keys");
  });
  const result = await client.getProfile(STEAM_ID, {});
  assert.equal(result.leetify.status, "not_configured");
  assert.equal(result.faceit.status, "not_configured");
  assert.match(result.leetify.message ?? "", /API key/i);
  assert.match(result.faceit.message ?? "", /API key/i);
});

test("loads current Leetify v3 profile shape and FACEIT directly with customer keys", async () => {
  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    if (url.includes("api-public.cs-prod.leetify.com/v3/profile")) {
      return json({
        id: "leetify-player",
        steam64_id: STEAM_ID,
        name: "Rat",
        privacy_mode: "public",
        ranks: {
          leetify: 7,
          premier: 14832,
          faceit: 8,
          faceit_elo: 1743,
          wingman: null,
          renown: null,
          competitive: [{ map_name: "de_mirage", rank: 12 }]
        },
        rating: {
          aim: 68.4,
          positioning: 55.2,
          utility: 49.1,
          clutch: 61.3,
          opening: 57.8,
          ct_leetify: 0.31,
          t_leetify: 0.22
        },
        winrate: 0.54,
        total_matches: 100,
        recent_matches: [{
          id: "recent-1",
          finished_at: "2026-08-30T17:00:00Z",
          data_source: "matchmaking",
          outcome: "win",
          rank: 12,
          rank_type: "competitive",
          map_name: "de_mirage",
          leetify_rating: 0.74,
          score: [13, 7],
          preaim: 11.5,
          reaction_time_ms: 421,
          accuracy_enemy_spotted: 0.37,
          accuracy_head: 0.21,
          spray_accuracy: 0.44
        }],
        recent_teammates: []
      });
    }
    if (url.includes("open.faceit.com/data/v4/players?")) {
      return json({
        player_id: "faceit-player",
        nickname: "Rat",
        faceit_url: "https://www.faceit.com/{lang}/players/Rat",
        games: { cs2: { faceit_elo: 1743, skill_level: 8, region: "EU" } }
      });
    }
    if (url.includes("/players/faceit-player/stats/cs2")) {
      return json({ lifetime: { "Average K/D Ratio": "1.21", "Average Headshots %": "52", "Win Rate %": "54" } });
    }
    if (url.includes("/players/faceit-player/history?")) {
      return json({
        items: [{
          match_id: "faceit-recent-1",
          finished_at: 1788109200,
          results: {
            winner: "faction1",
            score: { faction1: 13, faction2: 9 }
          },
          teams: {
            faction1: {
              players: [
                { player_id: "faceit-player", nickname: "Rat" },
                { player_id: "teammate", nickname: "Mouse" }
              ]
            },
            faction2: {
              players: [{ player_id: "opponent", nickname: "Cat" }]
            }
          }
        }]
      });
    }
    if (url.includes("/matches/faceit-recent-1/stats")) {
      return json({ rounds: [{ round_stats: { Map: "de_ancient", Region: "EU", Score: "13 / 9" } }] });
    }
    throw new Error(`unexpected URL ${url}`);
  };

  const client = new ProviderClient(fetchImpl);
  const result = await client.getProfile(STEAM_ID, { faceitApiKey: "faceit-user-key", leetifyApiKey: "leetify-user-key" });
  assert.equal(result.leetify.status, "ready");
  assert.equal(result.leetify.premier, 14832);
  assert.equal(result.leetify.winRate, 0.54);
  assert.equal(result.leetify.totalMatches, 100);
  assert.equal(result.leetify.competitiveRanks[0]?.mapName, "de_mirage");
  assert.equal(result.leetify.competitiveRanks[0]?.rankLabel, "Master Guardian II");
  assert.equal(result.leetify.recentMatches[0]?.mapName, "de_mirage");
  assert.equal(result.leetify.recentMatches[0]?.outcome, "win");
  assert.equal(result.leetify.recentMatches[0]?.score, "13-7");
  assert.equal(result.leetify.recentMatches[0]?.rating, 0.74);
  assert.equal(result.faceit.status, "ready");
  assert.equal(result.faceit.elo, 1743);
  assert.equal(result.faceit.level, 8);
  assert.equal(result.faceit.kd, 1.21);
  assert.deepEqual(result.faceit.recentRecord, { wins: 1, losses: 0 });
  assert.equal(result.faceit.recentMatches[0]?.outcome, "WIN");
  assert.equal(result.faceit.recentMatches[0]?.score, "13-9");
  assert.equal(result.faceit.recentMatches[0]?.mapName, "de_ancient");
});

test("keeps FACEIT history usable when latest match map enrichment is unavailable", async () => {
  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    if (url.includes("open.faceit.com/data/v4/players?")) {
      return json({
        player_id: "faceit-player",
        nickname: "Rat",
        faceit_url: "https://www.faceit.com/{lang}/players/Rat",
        games: { cs2: { faceit_elo: 1743, skill_level: 8, region: "EU" } }
      });
    }
    if (url.includes("/players/faceit-player/stats/cs2")) return json({ lifetime: {} });
    if (url.includes("/players/faceit-player/history?")) {
      return json({
        items: [{
          match_id: "faceit-recent-2",
          finished_at: 1788109200,
          results: { winner: "faction2", score: { faction1: 7, faction2: 13 } },
          teams: {
            faction1: { players: [{ player_id: "opponent" }] },
            faction2: { players: [{ player_id: "faceit-player" }] }
          }
        }]
      });
    }
    if (url.includes("/matches/faceit-recent-2/stats")) return json({ error: "temporarily unavailable" }, 503);
    throw new Error(`unexpected URL ${url}`);
  };

  const client = new ProviderClient(fetchImpl);
  const result = await client.getProfile(STEAM_ID, { faceitApiKey: "faceit-user-key" });
  assert.equal(result.faceit.status, "ready");
  assert.deepEqual(result.faceit.recentRecord, { wins: 1, losses: 0 });
  assert.equal(result.faceit.recentMatches[0]?.outcome, "WIN");
  assert.equal(result.faceit.recentMatches[0]?.score, "13-7");
  assert.equal(result.faceit.recentMatches[0]?.mapName, "");
});

test("maps Leetify 200 private profile responses to an explicit private state", async () => {
  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    if (url.includes("api-public.cs-prod.leetify.com/v3/profile")) {
      return json({
        id: "private-player",
        steam64_id: STEAM_ID,
        name: "Private Rat",
        privacy_mode: "private",
        ranks: { premier: null, competitive: [] },
        recent_matches: []
      });
    }
    throw new Error(`unexpected URL ${url}`);
  };

  const client = new ProviderClient(fetchImpl);
  const result = await client.getProfile(STEAM_ID, { leetifyApiKey: "leetify-user-key" });
  assert.equal(result.leetify.status, "private");
  assert.match(result.leetify.message ?? "", /private/i);
  assert.equal(result.leetify.competitiveRanks.length, 0);
  assert.equal(result.leetify.recentMatches.length, 0);
  assert.match(result.leetify.profileUrl ?? "", /leetify\.com/);
  assert.equal(result.faceit.status, "not_configured");
});

test("reports rejected customer key per provider", async () => {
  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    if (url.includes("leetify")) return json({ error: "unauthorized" }, 401);
    if (url.includes("faceit")) return json({ error: "unauthorized" }, 401);
    throw new Error(`unexpected URL ${url}`);
  };
  const client = new ProviderClient(fetchImpl);
  const result = await client.getProfile(STEAM_ID, { faceitApiKey: "bad-faceit", leetifyApiKey: "bad-leetify" });
  assert.equal(result.leetify.status, "unavailable");
  assert.match(result.leetify.message ?? "", /key was rejected/i);
  assert.equal(result.faceit.status, "unavailable");
  assert.match(result.faceit.message ?? "", /key was rejected/i);
});
