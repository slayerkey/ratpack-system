import type { LiveState, NormalizedWeapon, RawGsiPayload, Team } from "../core/types.js";

function numberOr(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function normalizeTeam(value: unknown): Team {
  if (typeof value !== "string") return "UNKNOWN";
  const team = value.toUpperCase();
  if (team === "CT") return "CT";
  if (team === "T") return "T";
  if (team === "SPECTATOR") return "SPECTATOR";
  return "UNKNOWN";
}

export function isCs2Payload(payload: RawGsiPayload): boolean {
  const appId = Number(payload.provider?.appid);
  return appId === 730;
}

function normalizeWeapons(payload: RawGsiPayload): NormalizedWeapon[] {
  const weapons = payload.player?.weapons;
  if (!weapons) return [];

  return Object.entries(weapons)
    .map(([key, weapon]) => ({
      key,
      name: weapon.name ?? "Unknown",
      type: weapon.type,
      state: weapon.state,
      ammoClip: optionalNumber(weapon.ammo_clip),
      ammoClipMax: optionalNumber(weapon.ammo_clip_max),
      ammoReserve: optionalNumber(weapon.ammo_reserve)
    }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

export function normalizeGsiPayload(payload: RawGsiPayload, receivedAt = Date.now()): LiveState {
  if (!isCs2Payload(payload)) {
    throw new Error("GSI payload is not from Counter-Strike 2 (appid 730)");
  }

  const state = payload.player?.state;
  const match = payload.player?.match_stats;
  const weapons = normalizeWeapons(payload);
  const currentWeapon = weapons.find((weapon) => weapon.state === "active");

  return {
    receivedAt,
    steamId: payload.player?.steamid ?? payload.provider?.steamid,
    playerName: payload.player?.name,
    playerTeam: normalizeTeam(payload.player?.team),
    activity: payload.player?.activity,
    mapName: payload.map?.name,
    mapMode: payload.map?.mode,
    mapPhase: payload.map?.phase,
    roundNumber: optionalNumber(payload.map?.round),
    roundPhase: payload.round?.phase,
    roundWinner: payload.round?.win_team ? normalizeTeam(payload.round.win_team) : undefined,
    bombState: payload.round?.bomb,
    ctScore: numberOr(payload.map?.team_ct?.score),
    tScore: numberOr(payload.map?.team_t?.score),
    health: optionalNumber(state?.health),
    armor: optionalNumber(state?.armor),
    helmet: state?.helmet,
    money: optionalNumber(state?.money),
    equipmentValue: optionalNumber(state?.equip_value),
    defuseKit: state?.defusekit,
    flashed: optionalNumber(state?.flashed),
    smoked: optionalNumber(state?.smoked),
    burning: optionalNumber(state?.burning),
    roundKills: numberOr(state?.round_kills),
    roundHeadshotKills: numberOr(state?.round_killhs),
    roundTotalDamage: numberOr(state?.round_totaldmg),
    kills: numberOr(match?.kills),
    deaths: numberOr(match?.deaths),
    assists: numberOr(match?.assists),
    mvps: numberOr(match?.mvps),
    score: numberOr(match?.score),
    weapons,
    currentWeapon
  };
}
