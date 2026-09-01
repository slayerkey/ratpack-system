import type { LiveState, SessionMetrics, Team } from "../core/types.js";

interface CompletedTotals {
  matches: number;
  wins: number;
  losses: number;
}

/** The values surfaced on the keys, scoped to a single match. */
interface MatchTotals {
  kills: number;
  deaths: number;
  assists: number;
  damage: number;
  rounds: number;
  observedKills: number;
  headshotKills: number;
}

interface MatchAccumulator {
  team: Team;
  mapName?: string;
  mapMode?: string;
  roundNumber?: number;
  maxRoundDamage: number;
  maxRoundHeadshots: number;
  maxRoundKills: number;
  committedDamage: number;
  committedRounds: number;
  committedHeadshots: number;
  committedKills: number;
  lastRoundDamage: number;
  lastRoundHeadshots: number;
  lastRoundKills: number;
  lastKills: number;
  lastDeaths: number;
  lastAssists: number;
  finalized: boolean;
}

const emptyTotals = (): CompletedTotals => ({ matches: 0, wins: 0, losses: 0 });

const emptyMatch = (): MatchTotals => ({
  kills: 0,
  deaths: 0,
  assists: 0,
  damage: 0,
  rounds: 0,
  observedKills: 0,
  headshotKills: 0
});

export class SessionTracker {
  private completed: CompletedTotals = emptyTotals();
  private current?: MatchAccumulator;
  /** Kept so the keys still show the finished match instead of blanking between games. */
  private lastMatch?: MatchTotals;

  reset(): void {
    this.completed = emptyTotals();
    this.current = undefined;
    this.lastMatch = undefined;
  }

  ingest(live: LiveState): SessionMetrics {
    const activePhase = live.mapPhase === "live" || live.mapPhase === "intermission";
    const gameOver = live.mapPhase === "gameover";

    // A player can leave one match and join another without the plugin ever seeing a
    // gameover packet. Without this the stale accumulator keeps pinning kills to the
    // previous match through Math.max and blends both matches into one percentage.
    if (this.current && !this.current.finalized && this.startsNewMatch(live, this.current)) {
      this.settleMatch(this.current);
      this.current = undefined;
    }

    if (!this.current && activePhase) {
      this.current = this.createMatch(live);
    }

    if (this.current) {
      this.updateMatch(live, this.current);

      if (gameOver && !this.current.finalized) {
        this.settleMatch(this.current, live);
        this.current = undefined;
      }
    }

    return this.snapshot();
  }

  snapshot(): SessionMetrics {
    const current = this.current && !this.current.finalized ? this.current : undefined;
    const totals = current ? this.matchTotals(current, false) : this.lastMatch ?? emptyMatch();
    const { kills, deaths, assists, damage, rounds, observedKills, headshotKills } = totals;

    return {
      matches: this.completed.matches,
      wins: this.completed.wins,
      losses: this.completed.losses,
      kills,
      deaths,
      assists,
      damage,
      rounds,
      headshotKills,
      kd: deaths === 0 ? kills : kills / deaths,
      adr: rounds === 0 ? 0 : damage / rounds,
      hsPercent: observedKills === 0 ? 0 : (headshotKills / observedKills) * 100,
      inMatch: Boolean(current)
    };
  }

  /** True when this payload clearly belongs to a different match than the one being tracked. */
  private startsNewMatch(live: LiveState, match: MatchAccumulator): boolean {
    // Warmup always precedes a match, so it reliably separates back to back games
    // played on the same map and mode.
    if (live.mapPhase === "warmup") return true;
    if (live.mapName !== undefined && match.mapName !== undefined && live.mapName !== match.mapName) return true;
    if (live.mapMode !== undefined && match.mapMode !== undefined && live.mapMode !== match.mapMode) return true;
    // player.match_stats defaults to zero when absent from a payload, so a kill or
    // death decrease is deliberately not treated as a match boundary here.
    return false;
  }

  private matchTotals(match: MatchAccumulator, settled: boolean): MatchTotals {
    const observedKills = match.committedKills + match.maxRoundKills;
    const headshots = match.committedHeadshots + match.maxRoundHeadshots;
    return {
      kills: match.lastKills,
      deaths: match.lastDeaths,
      assists: match.lastAssists,
      damage: match.committedDamage + match.maxRoundDamage,
      rounds: settled ? match.committedRounds : match.committedRounds + (match.roundNumber === undefined ? 0 : 1),
      observedKills,
      headshotKills: Math.min(observedKills, headshots)
    };
  }

  /** Closes a match, remembers its final values, and records a result when the score is known. */
  private settleMatch(match: MatchAccumulator, live?: LiveState): void {
    if (match.roundNumber !== undefined) this.commitRound(match);
    match.maxRoundDamage = 0;
    match.maxRoundHeadshots = 0;
    match.maxRoundKills = 0;
    match.finalized = true;

    this.lastMatch = this.matchTotals(match, true);
    this.completed.matches += 1;

    if (!live) return;
    const winner = this.winnerFromScore(live);
    if (winner !== "UNKNOWN" && match.team !== "UNKNOWN") {
      if (winner === match.team) this.completed.wins += 1;
      else this.completed.losses += 1;
    }
  }

  private createMatch(live: LiveState): MatchAccumulator {
    return {
      team: live.playerTeam,
      mapName: live.mapName,
      mapMode: live.mapMode,
      roundNumber: live.roundNumber,
      maxRoundDamage: live.roundTotalDamage,
      maxRoundHeadshots: live.roundHeadshotKills,
      maxRoundKills: live.roundKills,
      committedDamage: 0,
      committedRounds: 0,
      committedHeadshots: 0,
      committedKills: 0,
      lastRoundDamage: live.roundTotalDamage,
      lastRoundHeadshots: live.roundHeadshotKills,
      lastRoundKills: live.roundKills,
      lastKills: live.kills,
      lastDeaths: live.deaths,
      lastAssists: live.assists,
      finalized: false
    };
  }

  private updateMatch(live: LiveState, match: MatchAccumulator): void {
    if (live.playerTeam !== "UNKNOWN" && live.playerTeam !== "SPECTATOR") {
      match.team = live.playerTeam;
    }

    const roundChanged =
      live.roundNumber !== undefined &&
      match.roundNumber !== undefined &&
      live.roundNumber !== match.roundNumber;

    if (roundChanged) {
      this.commitRound(match);
      match.roundNumber = live.roundNumber;
      match.maxRoundDamage = live.roundTotalDamage;
      match.maxRoundHeadshots = live.roundHeadshotKills;
      match.maxRoundKills = live.roundKills;
    } else {
      if (match.roundNumber === undefined && live.roundNumber !== undefined) {
        match.roundNumber = live.roundNumber;
      }

      // Deathmatch and some respawn modes can reset player.state round counters
      // without advancing map.round. A damage reset is also a reliable life-reset
      // signal when the first packet from the new life already has the same kill
      // and headshot counts as the previous life.
      const damageReset = live.roundTotalDamage < match.lastRoundDamage;
      const respawnReset = live.roundKills < match.lastRoundKills || damageReset;
      if (respawnReset || live.roundHeadshotKills < match.lastRoundHeadshots) {
        match.committedDamage += match.maxRoundDamage;
        match.maxRoundDamage = 0;
        match.committedHeadshots += match.maxRoundHeadshots;
        match.maxRoundHeadshots = 0;
        match.committedKills += match.maxRoundKills;
        match.maxRoundKills = 0;
      }

      match.maxRoundDamage = Math.max(match.maxRoundDamage, live.roundTotalDamage);
      match.maxRoundHeadshots = Math.max(match.maxRoundHeadshots, live.roundHeadshotKills);
      match.maxRoundKills = Math.max(match.maxRoundKills, live.roundKills);
    }

    match.lastRoundDamage = live.roundTotalDamage;
    match.lastRoundHeadshots = live.roundHeadshotKills;
    match.lastRoundKills = live.roundKills;
    match.lastKills = Math.max(match.lastKills, live.kills);
    match.lastDeaths = Math.max(match.lastDeaths, live.deaths);
    match.lastAssists = Math.max(match.lastAssists, live.assists);
  }

  private commitRound(match: MatchAccumulator): void {
    match.committedDamage += match.maxRoundDamage;
    match.committedHeadshots += match.maxRoundHeadshots;
    match.committedKills += match.maxRoundKills;
    match.committedRounds += 1;
  }

  private winnerFromScore(live: LiveState): Team {
    if (live.ctScore > live.tScore) return "CT";
    if (live.tScore > live.ctScore) return "T";
    return "UNKNOWN";
  }
}
