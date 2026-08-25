export interface RawGsiPayload {
  provider?: { appid?: number; timestamp?: number; steamid?: string; name?: string };
  map?: {
    name?: string;
    mode?: string;
    phase?: string;
    round?: number;
    team_ct?: { score?: number };
    team_t?: { score?: number };
    round_wins?: Record<string, string>;
  };
  round?: { phase?: string; win_team?: string; bomb?: string };
  player?: {
    steamid?: string;
    team?: string;
    state?: {
      health?: number;
      armor?: number;
      helmet?: boolean;
      flashed?: number;
      smoked?: number;
      burning?: number;
      money?: number;
      round_kills?: number;
      round_killhs?: number;
      round_totaldmg?: number;
      equip_value?: number;
      defusekit?: boolean;
    };
    weapons?: Record<string, {
      name?: string;
      paintkit?: string;
      type?: string;
      state?: string;
      ammo_clip?: number;
      ammo_clip_max?: number;
      ammo_reserve?: number;
    }>;
    match_stats?: {
      kills?: number;
      assists?: number;
      deaths?: number;
      mvps?: number;
      score?: number;
    };
  };
  auth?: { token?: string };
}

export interface LiveState {
  receivedAt: number;
  providerSteamId?: string;
  map?: string;
  mode?: string;
  mapPhase?: string;
  round?: number;
  ctScore?: number;
  tScore?: number;
  roundPhase?: string;
  roundWinner?: string;
  bombState?: string;
  playerSteamId?: string;
  team?: string;
  health?: number;
  armor?: number;
  helmet?: boolean;
  money?: number;
  roundKills?: number;
  roundHeadshots?: number;
  roundDamage?: number;
  equipmentValue?: number;
  defuseKit?: boolean;
  kills?: number;
  assists?: number;
  deaths?: number;
  mvps?: number;
  score?: number;
  activeWeapon?: {
    name: string;
    type?: string;
    ammoClip?: number;
    ammoClipMax?: number;
    ammoReserve?: number;
  };
}

export interface SessionMetrics {
  matches: number;
  wins: number;
  losses: number;
  kills: number;
  deaths: number;
  assists: number;
  damage: number;
  rounds: number;
  headshotKills: number;
  kd: number;
  adr: number;
  hsPercent: number;
  inMatch: boolean;
}

export type SetupStage =
  | "idle"
  | "finding-cs2"
  | "starting-listener"
  | "writing-config"
  | "saving-settings"
  | "checking-cs2"
  | "ready";

export interface RuntimeStatus {
  cs2Running: boolean;
  gsiConfigured: boolean;
  gsiConnected: boolean;
  gsiRestartRequired?: boolean;
  setupStage?: SetupStage;
  detectedCs2Path?: string;
  lastPayloadAt?: number;
  configPath?: string;
  listenerPort?: number;
  error?: string;
}

export type LiveMetric =
  | "score"
  | "round"
  | "kills"
  | "deaths"
  | "assists"
  | "kd"
  | "adr"
  | "hs"
  | "health"
  | "armor"
  | "money"
  | "equipment"
  | "weapon"
  | "ammo"
  | "bomb"
  | "map"
  | "team";

export const LITE_LIVE_METRICS: readonly LiveMetric[] = ["score", "health", "money", "map"] as const;

export const PRO_LIVE_METRICS: readonly LiveMetric[] = [
  "score",
  "round",
  "kills",
  "deaths",
  "assists",
  "kd",
  "adr",
  "hs",
  "health",
  "armor",
  "money",
  "equipment",
  "weapon",
  "ammo",
  "bomb",
  "map",
  "team"
] as const;
