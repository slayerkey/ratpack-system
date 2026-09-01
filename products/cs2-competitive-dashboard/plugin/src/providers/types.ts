export type OnlineSourceStatus =
  | "not_configured"
  | "loading"
  | "ready"
  | "not_found"
  | "private"
  | "rate_limited"
  | "commercial_gate"
  | "offline"
  | "unavailable";

export interface CompetitiveRankEntry {
  mapName: string;
  rank: number;
  rankLabel?: string;
}

export interface RecentMatchSummary {
  id: string;
  source: string;
  mapName: string;
  outcome?: string;
  score?: string;
  finishedAt?: string;
  rating?: number;
}

export interface LeetifyData {
  status: OnlineSourceStatus;
  message?: string;
  profileUrl?: string;
  premier?: number;
  winRate?: number;
  totalMatches?: number;
  competitiveRanks: CompetitiveRankEntry[];
  recentMatches: RecentMatchSummary[];
}

export interface FaceitData {
  status: OnlineSourceStatus;
  message?: string;
  playerId?: string;
  nickname?: string;
  profileUrl?: string;
  elo?: number;
  level?: number;
  region?: string;
  kd?: number;
  hsPercent?: number;
  winRate?: number;
  recentRecord?: { wins: number; losses: number };
  recentMatches: RecentMatchSummary[];
}

export interface OnlineProfileSnapshot {
  requestedIdentity?: string;
  steamId64?: string;
  displayName?: string;
  updatedAt?: number;
  refreshing: boolean;
  error?: string;
  leetify: LeetifyData;
  faceit: FaceitData;
}

export function emptyOnlineSnapshot(identity?: string): OnlineProfileSnapshot {
  const status: OnlineSourceStatus = identity ? "unavailable" : "not_configured";
  return {
    requestedIdentity: identity,
    refreshing: false,
    leetify: { status, competitiveRanks: [], recentMatches: [] },
    faceit: { status, recentMatches: [] }
  };
}
