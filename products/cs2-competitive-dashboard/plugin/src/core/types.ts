export type Team = "CT" | "T" | "SPECTATOR" | "UNKNOWN";

export type WeaponState = "active" | "holstered" | "reloading" | string;

export interface RawGsiWeapon {
  name?: string;
  paintkit?: string;
  type?: string;
  state?: WeaponState;
  ammo_clip?: number;
  ammo_clip_max?: number;
  ammo_reserve?: number;
}

export interface RawGsiPayload {
  provider?: {
    name?: string;
    appid?: number | string;
    version?: number | string;
    steamid?: string;
    timestamp?: number;
  };
  auth?: { token?: string };
  map?: {
    mode?: string;
    name?: string;
    phase?: string;
    round?: number;
    team_ct?: { score?: number; consecutive_round_losses?: number; timeouts_remaining?: number; matches_won_this_series?: number };
    team_t?: { score?: number; consecutive_round_losses?: number; timeouts_remaining?: number; matches_won_this_series?: number };
    num_matches_to_win_series?: number;
    current_spectators?: number;
    souvenirs_total?: number;
  };
  round?: {
    phase?: string;
    win_team?: string;
    bomb?: string;
  };
  player?: {
    steamid?: string;
    name?: string;
    team?: string;
    activity?: string;
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
    weapons?: Record<string, RawGsiWeapon>;
    match_stats?: {
      kills?: number;
      assists?: number;
      deaths?: number;
      mvps?: number;
      score?: number;
    };
  };
  previously?: unknown;
  added?: unknown;
}

export interface NormalizedWeapon {
  key: string;
  name: string;
  type?: string;
  state?: string;
  ammoClip?: number;
  ammoClipMax?: number;
  ammoReserve?: number;
}

export interface LiveState {
  receivedAt: number;
  steamId?: string;
  playerName?: string;
  playerTeam: Team;
  activity?: string;
  mapName?: string;
  mapMode?: string;
  mapPhase?: string;
  roundNumber?: number;
  roundPhase?: string;
  roundWinner?: Team;
  bombState?: string;
  ctScore: number;
  tScore: number;
  health?: number;
  armor?: number;
  helmet?: boolean;
  money?: number;
  equipmentValue?: number;
  defuseKit?: boolean;
  flashed?: number;
  smoked?: number;
  burning?: number;
  roundKills: number;
  roundHeadshotKills: number;
  roundTotalDamage: number;
  kills: number;
  deaths: number;
  assists: number;
  mvps: number;
  score: number;
  weapons: NormalizedWeapon[];
  currentWeapon?: NormalizedWeapon;
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

export interface RuntimeStatus {
  cs2Running: boolean;
  gsiConfigured: boolean;
  gsiConnected: boolean;
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
