import assert from "node:assert/strict";
import test from "node:test";
import { handleRequest, resolveSteamIdentity } from "../src/worker.mjs";

const STEAM = "76561198000000000";

function response(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function routeFetch(routes) {
  return async (input, init = {}) => {
    const url = String(input);
    const route = routes.find((candidate) => url.includes(candidate.match));
    if (!route) throw new Error(`Unexpected fetch: ${url}`);
    if (route.assert) route.assert(url, init);
    return response(route.body, route.status ?? 200);
  };
}

test("accepts a raw SteamID64 without an upstream lookup", async () => {
  let called = false;
  const resolved = await resolveSteamIdentity(STEAM, {}, async () => { called = true; return response({}); });
  assert.equal(resolved, STEAM);
  assert.equal(called, false);
});

test("resolves a Steam vanity URL only with server-side Steam credentials", async () => {
  const fetchImpl = routeFetch([{ match: "ResolveVanityURL", body: { response: { success: 1, steamid: STEAM } } }]);
  const resolved = await resolveSteamIdentity("https://steamcommunity.com/id/packrattest/", { STEAM_WEB_API_KEY: "secret" }, fetchImpl);
  assert.equal(resolved, STEAM);
  await assert.rejects(() => resolveSteamIdentity("packrattest", {}, fetchImpl), /STEAM_WEB_API_KEY/);
});

test("normalizes Leetify and FACEIT without storing or proxying raw payloads", async () => {
  const fetchImpl = routeFetch([
    {
      match: "api-public.cs-prod.leetify.com/v3/profile",
      assert: (url) => assert.match(url, new RegExp(`steam64_id=${STEAM}`)),
      body: {
        name: "Rat",
        winrate: 0.55,
        total_matches: 42,
        ranks: { premier: 14832, competitive: [{ map_name: "de_mirage", rank: 12 }] },
        recent_matches: [{ id: "l1", data_source: "matchmaking", map_name: "de_mirage", outcome: "win", score: [13, 8], finished_at: "2026-08-23T01:00:00Z", leetify_rating: 0.41 }]
      }
    },
    {
      match: "open.faceit.com/data/v4/players?",
      assert: (_url, init) => assert.equal(init.headers.Authorization, "Bearer faceit-secret"),
      body: { player_id: "faceit-player", nickname: "RatFaceit", faceit_url: "https://www.faceit.com/{lang}/players/RatFaceit", games: { cs2: { faceit_elo: 1743, skill_level: 8, region: "EU" } } }
    },
    {
      match: "/players/faceit-player/stats/cs2",
      body: { lifetime: { "Average K/D Ratio": "1.21", "Average Headshots %": "48", "Win Rate %": "53" } }
    },
    {
      match: "/players/faceit-player/history?",
      body: { items: [{ match_id: "f1", finished_at: 1787450000, results: { winner: "faction1", score: { faction1: 13, faction2: 9 } }, teams: { faction1: { roster: [{ player_id: "faceit-player" }] }, faction2: { roster: [{ player_id: "other" }] } } }] }
    }
  ]);

  const request = new Request(`https://gateway.example/v1/cs2/profile?steam=${STEAM}`);
  const result = await handleRequest(request, { FACEIT_API_KEY: "faceit-secret", LEETIFY_API_KEY: "leetify-secret" }, fetchImpl);
  assert.equal(result.status, 200);
  assert.equal(result.headers.get("cache-control"), "no-store, max-age=0");
  const body = await result.json();
  assert.equal(body.steamId64, STEAM);
  assert.equal(body.leetify.premier, 14832);
  assert.equal(body.leetify.competitiveRanks[0].rankLabel, "Master Guardian II");
  assert.equal(body.faceit.elo, 1743);
  assert.equal(body.faceit.level, 8);
  assert.equal(body.faceit.kd, 1.21);
  assert.equal(body.faceit.hsPercent, 48);
  assert.deepEqual(body.faceit.recentRecord, { wins: 1, losses: 0 });
  assert.equal(body.faceit.recentMatches[0].outcome, "WIN");
  assert.equal(body.faceit.recentMatches[0].score, "13-9");
  assert.equal("ranks" in body.leetify, false);
  assert.equal("lifetime" in body.faceit, false);
});

test("returns honest source-level not-found states instead of failing the whole profile", async () => {
  const fetchImpl = routeFetch([
    { match: "api-public.cs-prod.leetify.com/v3/profile", body: { error: "not found" }, status: 404 },
    { match: "open.faceit.com/data/v4/players?", body: { error: "not found" }, status: 404 }
  ]);
  const result = await handleRequest(new Request(`https://gateway.example/v1/cs2/profile?steam=${STEAM}`), { FACEIT_API_KEY: "x" }, fetchImpl);
  const body = await result.json();
  assert.equal(body.leetify.status, "not_found");
  assert.equal(body.faceit.status, "not_found");
});

test("surfaces FACEIT rate limits as a source state", async () => {
  const fetchImpl = routeFetch([
    { match: "api-public.cs-prod.leetify.com/v3/profile", body: { name: "Rat", ranks: { competitive: [] }, recent_matches: [] } },
    { match: "open.faceit.com/data/v4/players?", body: { error: "slow down" }, status: 429 }
  ]);
  const result = await handleRequest(new Request(`https://gateway.example/v1/cs2/profile?steam=${STEAM}`), { FACEIT_API_KEY: "x" }, fetchImpl);
  const body = await result.json();
  assert.equal(body.leetify.status, "ready");
  assert.equal(body.faceit.status, "rate_limited");
});

test("does not expose any arbitrary upstream URL surface", async () => {
  const result = await handleRequest(new Request("https://gateway.example/v1/cs2/profile?url=https://evil.example"), {}, async () => { throw new Error("should not fetch"); });
  assert.equal(result.status, 400);
  assert.equal(result.headers.get("cache-control"), "no-store, max-age=0");
});
