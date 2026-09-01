import assert from "node:assert/strict";
import test from "node:test";
import { normalizeGsiPayload } from "../src/gsi/normalize.js";

const payload = {
  provider: { appid: 730, steamid: "76561198000000000" },
  map: { name: "de_mirage", mode: "competitive", phase: "live", round: 7, team_ct: { score: 4 }, team_t: { score: 3 } },
  round: { phase: "live", bomb: "carried" },
  player: {
    steamid: "76561198000000000",
    name: "Rat",
    team: "CT",
    state: { health: 82, armor: 73, helmet: true, money: 4250, equip_value: 5100, round_kills: 2, round_killhs: 1, round_totaldmg: 184 },
    match_stats: { kills: 17, deaths: 11, assists: 4, mvps: 2, score: 38 },
    weapons: {
      weapon_0: { name: "weapon_knife", type: "Knife", state: "holstered" },
      weapon_1: { name: "weapon_ak47", type: "Rifle", state: "active", ammo_clip: 22, ammo_clip_max: 30, ammo_reserve: 90 }
    }
  }
};

test("normalizes supported normal-player GSI fields", () => {
  const state = normalizeGsiPayload(payload, 1234);
  assert.equal(state.receivedAt, 1234);
  assert.equal(state.mapName, "de_mirage");
  assert.equal(state.ctScore, 4);
  assert.equal(state.tScore, 3);
  assert.equal(state.health, 82);
  assert.equal(state.money, 4250);
  assert.equal(state.kills, 17);
  assert.equal(state.deaths, 11);
  assert.equal(state.currentWeapon?.name, "weapon_ak47");
  assert.equal(state.currentWeapon?.ammoClip, 22);
});

test("rejects non-CS2 payloads", () => {
  assert.throws(() => normalizeGsiPayload({ provider: { appid: 999 } }), /appid 730/);
});
