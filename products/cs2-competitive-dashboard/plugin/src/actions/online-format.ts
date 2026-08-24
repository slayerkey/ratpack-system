import type { DisplayValue } from "./format.js";
import type { FaceitData, LeetifyData, OnlineProfileSnapshot, OnlineSourceStatus } from "../providers/types.js";

export type CompetitiveMetric = "premier" | "current-map-rank" | "best-map-rank" | "recent-result" | "win-rate" | "leetify-rating";
export type FaceitMetric = "elo" | "level" | "region" | "kd" | "hs" | "win-rate" | "recent-record" | "recent-match";

export const COMPETITIVE_METRICS: readonly CompetitiveMetric[] = [
  "premier",
  "current-map-rank",
  "best-map-rank",
  "recent-result",
  "win-rate",
  "leetify-rating"
];

export const FACEIT_METRICS: readonly FaceitMetric[] = [
  "elo",
  "level",
  "region",
  "kd",
  "hs",
  "win-rate",
  "recent-record",
  "recent-match"
];

function fixed(value: number | undefined, digits = 2): string {
  return value === undefined || !Number.isFinite(value) ? "--" : value.toFixed(digits);
}

function percent(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return "--";
  const normalized = value <= 1 ? value * 100 : value;
  return `${Math.round(normalized)}%`;
}

function cleanMap(map?: string): string {
  const value = map?.trim();
  return (value || "--").replace(/^de_/, "").replaceAll("_", " ").toUpperCase();
}

function sourceState(source: string, status: OnlineSourceStatus, message?: string): DisplayValue | undefined {
  switch (status) {
    case "ready": return undefined;
    case "not_configured": return { label: source, value: "SETUP", subtitle: "ADD STEAM", tone: "warn" };
    case "loading": return { label: source, value: "LOADING", tone: "muted" };
    case "not_found": return { label: source, value: "NOT FOUND", subtitle: message, tone: "warn" };
    case "private": return { label: source, value: "PRIVATE", subtitle: message, tone: "warn" };
    case "rate_limited": return { label: source, value: "LIMITED", subtitle: "TRY LATER", tone: "warn" };
    case "commercial_gate": return { label: source, value: "UNAVAILABLE", subtitle: "PROVIDER GATE", tone: "warn" };
    case "offline": return { label: source, value: "OFFLINE", subtitle: "API", tone: "danger" };
    case "unavailable": return { label: source, value: "UNAVAILABLE", subtitle: message ?? "OPEN SETUP", tone: "muted" };
  }
}

function leetifyReady(online: OnlineProfileSnapshot): LeetifyData | DisplayValue {
  return sourceState("COMPETITIVE", online.leetify.status, online.leetify.message) ?? online.leetify;
}

function faceitReady(online: OnlineProfileSnapshot): FaceitData | DisplayValue {
  return sourceState("FACEIT", online.faceit.status, online.faceit.message) ?? online.faceit;
}

function isDisplay(value: LeetifyData | FaceitData | DisplayValue): value is DisplayValue {
  return "label" in value && "value" in value;
}

export function competitiveDisplay(metric: CompetitiveMetric, online: OnlineProfileSnapshot, currentMap?: string): DisplayValue {
  const source = leetifyReady(online);
  if (isDisplay(source)) return source;

  switch (metric) {
    case "premier":
      return source.premier === undefined
        ? { label: "PREMIER", value: "UNRANKED", tone: "muted" }
        : { label: "PREMIER", value: Math.round(source.premier).toLocaleString("en-US"), subtitle: "CS RATING" };
    case "current-map-rank": {
      if (!currentMap) return { label: "MAP RANK", value: "NO MAP", subtitle: "PLAY CS2", tone: "muted" };
      const rank = source.competitiveRanks.find((entry) => entry.mapName.toLowerCase() === currentMap.toLowerCase());
      return rank
        ? { label: cleanMap(rank.mapName), value: rank.rankLabel ?? `RANK ${rank.rank}` }
        : { label: cleanMap(currentMap), value: "NO RANK", tone: "muted" };
    }
    case "best-map-rank": {
      const rank = [...source.competitiveRanks].sort((a, b) => b.rank - a.rank)[0];
      return rank
        ? { label: "BEST MAP", value: rank.rankLabel ?? `RANK ${rank.rank}`, subtitle: cleanMap(rank.mapName) }
        : { label: "BEST MAP", value: "NO RANK", tone: "muted" };
    }
    case "recent-result": {
      const match = source.recentMatches[0];
      return match
        ? { label: "RECENT", value: (match.outcome ?? "--").toUpperCase(), subtitle: `${cleanMap(match.mapName)}${match.score ? ` ${match.score}` : ""}` }
        : { label: "RECENT", value: "NO MATCHES", tone: "muted" };
    }
    case "win-rate":
      return { label: "WIN RATE", value: percent(source.winRate), subtitle: source.totalMatches === undefined ? undefined : `${source.totalMatches} MATCHES` };
    case "leetify-rating": {
      const match = currentMap
        ? source.recentMatches.find((entry) => entry.mapName.toLowerCase() === currentMap.toLowerCase())
        : source.recentMatches[0];
      return match?.rating === undefined
        ? { label: "LEETIFY RATING", value: "--", subtitle: currentMap ? cleanMap(currentMap) : "NO MATCHES", tone: "muted" }
        : { label: "LEETIFY RATING", value: fixed(match.rating, 2), subtitle: cleanMap(match.mapName) };
    }
  }
}

export function faceitDisplay(metric: FaceitMetric, online: OnlineProfileSnapshot): DisplayValue {
  const source = faceitReady(online);
  if (isDisplay(source)) return source;

  switch (metric) {
    case "elo": return { label: "FACEIT ELO", value: source.elo === undefined ? "--" : Math.round(source.elo).toLocaleString("en-US"), subtitle: source.level ? `LEVEL ${source.level}` : undefined };
    case "level": return { label: "FACEIT", value: source.level === undefined ? "UNRANKED" : `LEVEL ${source.level}`, subtitle: source.elo === undefined ? undefined : `${Math.round(source.elo)} ELO` };
    case "region": return { label: "FACEIT REGION", value: source.region?.toUpperCase() ?? "--", subtitle: source.nickname };
    case "kd": return { label: "FACEIT K/D", value: fixed(source.kd, 2) };
    case "hs": return { label: "FACEIT HS", value: percent(source.hsPercent) };
    case "win-rate": return { label: "FACEIT WIN RATE", value: percent(source.winRate) };
    case "recent-record": {
      const record = source.recentRecord;
      return record
        ? { label: "FACEIT FORM", value: `${record.wins}W ${record.losses}L`, subtitle: `${record.wins + record.losses} RECENT` }
        : { label: "FACEIT FORM", value: "NO MATCHES", tone: "muted" };
    }
    case "recent-match": {
      const match = source.recentMatches[0];
      return match
        ? { label: "FACEIT RECENT", value: (match.outcome ?? "--").toUpperCase(), subtitle: `${cleanMap(match.mapName)}${match.score ? ` ${match.score}` : ""}` }
        : { label: "FACEIT RECENT", value: "NO MATCHES", tone: "muted" };
    }
  }
}
