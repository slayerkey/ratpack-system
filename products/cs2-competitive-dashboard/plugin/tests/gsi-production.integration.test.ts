import assert from "node:assert/strict";
import test from "node:test";
import { liveDisplay } from "../src/actions/format.js";
import { DashboardRuntime } from "../src/runtime.js";
import { ingestGsi } from "../src/runtime-bridge.js";
import { GsiServer } from "../src/gsi/server.js";

const token = "production-integration-test-token";
const payload = {
  provider: { appid: 730, steamid: "76561198000000000" },
  auth: { token },
  map: { name: "de_mirage", mode: "competitive", phase: "live", round: 7, team_ct: { score: 4 }, team_t: { score: 3 } },
  round: { phase: "live", bomb: "carried" },
  player: {
    steamid: "76561198000000000",
    name: "Rat",
    team: "CT",
    state: { health: 82, armor: 73, helmet: true, money: 4250, equip_value: 5100, round_kills: 2, round_killhs: 1, round_totaldmg: 184 },
    match_stats: { kills: 17, deaths: 11, assists: 4, mvps: 2, score: 38 },
    weapons: {
      weapon_1: { name: "weapon_ak47", type: "Rifle", state: "active", ammo_clip: 22, ammo_clip_max: 30, ammo_reserve: 90 }
    }
  }
};

async function post(url: string, body: string, headers: Record<string, string> = {}): Promise<Response> {
  return fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body
  });
}

test("exact production GSI server drives the dashboard runtime and live key display", async () => {
  const runtime = new DashboardRuntime();
  const server = new GsiServer();
  const port = await server.start({
    token,
    // Stay inside the dedicated Pro block while using a high port so this test does
    // not share an HTTP connection pool entry with the invalid traffic test below.
    preferredPort: 32145,
    onPayload: (incoming) => ingestGsi(runtime, incoming)
  });
  const origin = `http://127.0.0.1:${port}`;

  try {
    const response = await post(`${origin}/`, JSON.stringify(payload));
    assert.equal(response.status, 200);

    const snapshot = runtime.snapshot();
    assert.equal(snapshot.status.gsiConnected, true);
    assert.equal(snapshot.live?.health, 82);
    assert.equal(snapshot.live?.money, 4250);
    assert.equal(snapshot.live?.kills, 17);
    assert.equal(snapshot.live?.currentWeapon?.ammoClip, 22);

    const health = liveDisplay("health", snapshot.live, snapshot.session, snapshot.status);
    assert.equal(health.value, "82");

    const diagnosticResponse = await fetch(`${origin}/packrat/diagnostics`);
    assert.equal(diagnosticResponse.status, 200);
    const diagnostic = await diagnosticResponse.json() as { signature?: string; state?: { requestCount?: number; lastPacketAt?: string } };
    assert.equal(diagnostic.signature, "packrat-cs2-competitive-dashboard");
    assert.ok((diagnostic.state?.requestCount ?? 0) >= 1);
    assert.ok(diagnostic.state?.lastPacketAt);
  } finally {
    await server.stop();
  }
});

test("production GSI server accepts legacy /gsi but rejects invalid traffic", async () => {
  const server = new GsiServer();
  const port = await server.start({ token, preferredPort: 32146, onPayload: () => undefined });
  const origin = `http://127.0.0.1:${port}`;

  try {
    assert.equal((await post(`${origin}/gsi`, JSON.stringify(payload))).status, 200);

    const wrongToken = structuredClone(payload);
    wrongToken.auth.token = "wrong";
    assert.equal((await post(`${origin}/`, JSON.stringify(wrongToken))).status, 401);

    const wrongApp = structuredClone(payload);
    wrongApp.provider.appid = 999;
    assert.equal((await post(`${origin}/`, JSON.stringify(wrongApp))).status, 400);

    assert.equal((await post(`${origin}/`, "{broken-json")).status, 400);
    assert.equal((await fetch(`${origin}/`, { method: "GET" })).status, 405);
    assert.equal((await post(`${origin}/wrong-route`, JSON.stringify(payload))).status, 404);
  } finally {
    await server.stop();
  }
});
