import assert from "node:assert/strict";
import test from "node:test";
import { GatewayClient, GatewayError } from "../src/providers/gateway-client.js";

const profile = {
  requestedIdentity: "76561198000000000",
  steamId64: "76561198000000000",
  displayName: "Rat",
  updatedAt: 1000,
  refreshing: false,
  leetify: {
    status: "ready",
    premier: 14832,
    winRate: 0.54,
    competitiveRanks: [{ mapName: "de_mirage", rank: 12, rankLabel: "MG2" }],
    recentMatches: []
  },
  faceit: {
    status: "ready",
    nickname: "Rat",
    elo: 1743,
    level: 8,
    recentMatches: []
  }
};

test("returns honest unavailable state when no production gateway is configured", async () => {
  const client = new GatewayClient("");
  const result = await client.getProfile("76561198000000000");
  assert.equal(result.leetify.status, "unavailable");
  assert.equal(result.faceit.status, "unavailable");
  assert.match(result.error ?? "", /not configured/);
});

test("normalizes a valid gateway profile", async () => {
  const fetchImpl: typeof fetch = async () => new Response(JSON.stringify(profile), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
  const client = new GatewayClient("https://example.test", fetchImpl);
  const result = await client.getProfile("76561198000000000");
  assert.equal(result.leetify.premier, 14832);
  assert.equal(result.faceit.elo, 1743);
  assert.equal(result.faceit.level, 8);
});

test("surfaces gateway HTTP errors", async () => {
  const fetchImpl: typeof fetch = async () => new Response(JSON.stringify({ error: "rate limited" }), {
    status: 429,
    headers: { "content-type": "application/json" }
  });
  const client = new GatewayClient("https://example.test", fetchImpl);
  await assert.rejects(() => client.getProfile("76561198000000000"), (error: unknown) => {
    assert.ok(error instanceof GatewayError);
    assert.equal(error.status, 429);
    return true;
  });
});
