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

test("loads Leetify and FACEIT directly with customer keys", async () => {
  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    if (url.includes("api-public.cs-prod.leetify.com/v3/profile")) {
      return json({
        name: "Rat",
        ranks: {
          premier: 14832,
          competitive: [{ map_name: "de_mirage", rank: 12 }]
        },
        winrate: 0.54,
        total_matches: 100,
        recent_matches: []
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
    if (url.includes("/stats/cs2")) {
      return json({ lifetime: { "Average K/D Ratio": "1.21", "Average Headshots %": "52", "Win Rate %": "54" } });
    }
    if (url.includes("/history?")) return json({ items: [] });
    throw new Error(`unexpected URL ${url}`);
  };

  const client = new ProviderClient(fetchImpl);
  const result = await client.getProfile(STEAM_ID, { faceitApiKey: "faceit-user-key", leetifyApiKey: "leetify-user-key" });
  assert.equal(result.leetify.status, "ready");
  assert.equal(result.leetify.premier, 14832);
  assert.equal(result.leetify.competitiveRanks[0]?.mapName, "de_mirage");
  assert.equal(result.faceit.status, "ready");
  assert.equal(result.faceit.elo, 1743);
  assert.equal(result.faceit.level, 8);
  assert.equal(result.faceit.kd, 1.21);
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
