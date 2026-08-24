import type { LiveState, SessionMetrics, Team } from "../core/types.js";

interface CompletedTotals {
  matches: number;
  wins: number;
  losses: number;
  kills: number;
  deaths: number;
  assists: number;
  damage: number;
  rounds: number;
  headshotKills: number;
}

interface MatchAccumulator {
  team: Team;
  roundNumber?: number;
  maxRoundDamage: number;
  maxRoundHeadshots: number;
  committedDamage: number;
  committedRounds: number;
  committedHeadshots: number;
  lastKills: number;
  lastDeaths: number;
  lastAssists: number;
  finalized: boolean;
}

const emptyTotals = (): CompletedTotals => ({
  matches: 0,
  wins: 0,
  losses: 0,
  kills: 0,
  deaths: 0,
  assists: 0,
  damage: 0,
  rounds: 0,
  headshotKills: 0
});

export class SessionTracker {
  private completed: CompletedTotals = emptyTotals();
  private current?: MatchAccumulator;

  reset(): void {
    this.completed = emptyTotals();
    this.current = undefined;
  }

  ingest(live: LiveState): SessionMetrics {
    const activePhase = live.mapPhase === "live" || live.mapPhase === "warmup" || live.mapPhase === "intermission";
    const gameOver = live.mapPhase === "gameover";

    if (!this.current && activePhase) {
      this.current = this.createMatch(live);
    }

    if (this.current) {
      this.updateMatch(live, this.current);

      if (gameOver && !this.current.finalized) {
        this.finalizeMatch(live, this.current);
      }
    }

    return this.snapshot();
  }

  snapshot(): SessionMetrics {
    const current = this.current && !this.current.finalized ? this.current : undefined;
    const currentDamage = current ? current.committedDamage + current.maxRoundDamage : 0;
    const currentRounds = current ? current.committedRounds + (current.roundNumber === undefined ? 0 : 1) : 0;
    const currentHeadshots = current ? current.committedHeadshots + current.maxRoundHeadshots : 0;
    const kills = this.completed.kills + (current?.lastKills ?? 0);
    const deaths = this.completed.deaths + (current?.lastDeaths ?? 0);
    const assists = this.completed.assists + (current?.lastAssists ?? 0);
    const damage = this.completed.damage + currentDamage;
    const rounds = this.completed.rounds + currentRounds;
    const headshotKills = this.completed.headshotKills + currentHeadshots;

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
      hsPercent: kills === 0 ? 0 : (headshotKills / kills) * 100,
      inMatch: Boolean(current)
    };
  }

  private createMatch(live: LiveState): MatchAccumulator {
    return {
      team: live.playerTeam,
      roundNumber: live.roundNumber,
      maxRoundDamage: live.roundTotalDamage,
      maxRoundHeadshots: live.roundHeadshotKills,
      committedDamage: 0,
      committedRounds: 0,
      committedHeadshots: 0,
      lastKills: live.kills,
      lastDeaths: live.deaths,
      lastAssists: live.assists,
      finalized: false
    };
  }

  private updateMatch(live: LiveState, match: MatchAccumulator): void {
    if (match.team === "UNKNOWN" && live.playerTeam !== "UNKNOWN") {
      match.team = live.playerTeam;
    }

    if (live.roundNumber !== undefined && match.roundNumber !== undefined && live.roundNumber !== match.roundNumber) {
      this.commitRound(match);
      match.roundNumber = live.roundNumber;
      match.maxRoundDamage = 0;
      match.maxRoundHeadshots = 0;
    } else if (match.roundNumber === undefined && live.roundNumber !== undefined) {
      match.roundNumber = live.roundNumber;
    }

    match.maxRoundDamage = Math.max(match.maxRoundDamage, live.roundTotalDamage);
    match.maxRoundHeadshots = Math.max(match.maxRoundHeadshots, live.roundHeadshotKills);
    match.lastKills = Math.max(match.lastKills, live.kills);
    match.lastDeaths = Math.max(match.lastDeaths, live.deaths);
    match.lastAssists = Math.max(match.lastAssists, live.assists);
  }

  private commitRound(match: MatchAccumulator): void {
    match.committedDamage += match.maxRoundDamage;
    match.committedHeadshots += match.maxRoundHeadshots;
    match.committedRounds += 1;
  }

  private finalizeMatch(live: LiveState, match: MatchAccumulator): void {
    if (match.roundNumber !== undefined) {
      this.commitRound(match);
    }

    match.finalized = true;
    this.completed.matches += 1;
    this.completed.kills += match.lastKills;
    this.completed.deaths += match.lastDeaths;
    this.completed.assists += match.lastAssists;
    this.completed.damage += match.committedDamage;
    this.completed.rounds += match.committedRounds;
    this.completed.headshotKills += match.committedHeadshots;

    const winner = this.winnerFromScore(live);
    if (winner !== "UNKNOWN" && match.team !== "UNKNOWN") {
      if (winner === match.team) this.completed.wins += 1;
      else this.completed.losses += 1;
    }
  }

  private winnerFromScore(live: LiveState): Team {
    if (live.ctScore > live.tScore) return "CT";
    if (live.tScore > live.ctScore) return "T";
    return "UNKNOWN";
  }
}
