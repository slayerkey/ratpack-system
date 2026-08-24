import { emptyOnlineSnapshot, type FaceitData, type LeetifyData, type OnlineProfileSnapshot, type OnlineSourceStatus, type RecentMatchSummary } from "./types.js";

const LEETIFY_BASE = "https://api-public.cs-prod.leetify.com";
const FACEIT_BASE = "https://open.faceit.com/data/v4";
const STEAM_COMMUNITY_BASE = "https://steamcommunity.com";
const STEAM64_RE = /^7656119\d{10}$/;

const COMPETITIVE_RANKS = [
  undefined,
  "Silver I", "Silver II", "Silver III", "Silver IV", "Silver Elite", "Silver Elite Master",
  "Gold Nova I", "Gold Nova II", "Gold Nova III", "Gold Nova Master",
  "Master Guardian I", "Master Guardian II", "Master Guardian Elite", "Distinguished Master Guardian",
  "Legendary Eagle", "Legendary Eagle Master", "Supreme Master First Class", "Global Elite"
] as const;

export interface ProviderCredentials {
  faceitApiKey?: string;
  leetifyApiKey?: string;
}

export class ProviderClient {
  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  async getProfile(identityInput: string, credentials: ProviderCredentials, signal?: AbortSignal): Promise<OnlineProfileSnapshot> {
    const identity = identityInput.trim();
    if (!identity) return emptyOnlineSnapshot();

    const steamId64 = await this.resolveSteamIdentity(identity, signal);
    const [leetify, faceit] = await Promise.all([
      credentials.leetifyApiKey?.trim()
        ? this.fetchLeetify(steamId64, credentials.leetifyApiKey.trim(), signal)
        : Promise.resolve<LeetifyData>({
            status: "not_configured",
            message: "Add your free Leetify API key in setup",
            competitiveRanks: [],
            recentMatches: []
          }),
      credentials.faceitApiKey?.trim()
        ? this.fetchFaceit(steamId64, credentials.faceitApiKey.trim(), signal)
        : Promise.resolve<FaceitData>({
            status: "not_configured",
            message: "Add your free FACEIT API key in setup",
            recentMatches: []
          })
    ]);

    return {
      requestedIdentity: identity,
      steamId64,
      displayName: faceit.nickname,
      updatedAt: Date.now(),
      refreshing: false,
      leetify,
      faceit
    };
  }

  async validateLeetifyKey(apiKey: string, signal?: AbortSignal): Promise<boolean> {
    const key = apiKey.trim();
    if (!key) return false;
    const response = await this.fetchImpl(`${LEETIFY_BASE}/api-key/validate`, {
      method: "GET",
      headers: { accept: "application/json", Authorization: `Bearer ${key}` },
      signal
    });
    return response.ok;
  }

  private async resolveSteamIdentity(identity: string, signal?: AbortSignal): Promise<string> {
    if (STEAM64_RE.test(identity)) return identity;

    let parsed: URL | undefined;
    try { parsed = new URL(identity); } catch { parsed = undefined; }

    if (parsed && /(^|\.)steamcommunity\.com$/i.test(parsed.hostname)) {
      const parts = parsed.pathname.split("/").filter(Boolean);
      if (parts[0]?.toLowerCase() === "profiles" && STEAM64_RE.test(parts[1] ?? "")) return parts[1]!;
      if (parts[0]?.toLowerCase() === "id" && parts[1]) return this.resolveVanity(parts[1], signal);
    }

    if (/^[A-Za-z0-9_-]{2,64}$/.test(identity)) return this.resolveVanity(identity, signal);
    throw new Error("Steam profile format is not supported");
  }

  private async resolveVanity(vanity: string, signal?: AbortSignal): Promise<string> {
    const url = new URL(`/id/${encodeURIComponent(vanity)}/`, STEAM_COMMUNITY_BASE);
    url.searchParams.set("xml", "1");
    const response = await this.fetchImpl(url, {
      method: "GET",
      headers: {
        accept: "application/xml,text/xml;q=0.9,text/plain;q=0.8",
        "user-agent": "PackRat-CS2-Competitive-Dashboard/1.0"
      },
      redirect: "follow",
      signal
    });
    if (!response.ok) throw new Error(response.status === 404 ? "Steam profile was not found" : `Steam profile lookup failed (${response.status})`);
    const xml = await response.text();
    const steamId64 = xml.match(/<steamID64>\s*(7656119\d{10})\s*<\/steamID64>/i)?.[1];
    if (!steamId64 || !STEAM64_RE.test(steamId64)) throw new Error("Steam profile did not expose a valid SteamID64");
    return steamId64;
  }

  private async fetchLeetify(steamId64: string, apiKey: string, signal?: AbortSignal): Promise<LeetifyData> {
    const url = new URL(`${LEETIFY_BASE}/v3/profile`);
    url.searchParams.set("steam64_id", steamId64);
    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        headers: { accept: "application/json", Authorization: `Bearer ${apiKey}` },
        signal
      });
    } catch (error) {
      return this.sourceFailure("offline", `Leetify request failed: ${this.errorMessage(error)}`, "leetify");
    }
    if (!response.ok) return this.mapFailure("Leetify", response.status, "leetify");
    const body = await this.safeJson(response) as any;
    if (!body || typeof body !== "object") return this.sourceFailure("unavailable", "Leetify returned an invalid response", "leetify");

    return {
      status: "ready",
      profileUrl: `https://leetify.com/app/profile/${encodeURIComponent(steamId64)}`,
      premier: this.finiteNumber(body.ranks?.premier),
      winRate: this.finiteNumber(body.winrate),
      totalMatches: this.finiteNumber(body.total_matches),
      competitiveRanks: this.array(body.ranks?.competitive).map((rank: any) => ({
        mapName: this.stringValue(rank?.map_name) ?? "",
        rank: this.finiteNumber(rank?.rank) ?? 0,
        rankLabel: this.competitiveRankLabel(this.finiteNumber(rank?.rank))
      })).filter((rank) => rank.mapName && rank.rank > 0),
      recentMatches: this.array(body.recent_matches).slice(0, 10).map((match: any) => ({
        id: this.stringValue(match?.id) ?? "",
        source: this.stringValue(match?.data_source) ?? "leetify",
        mapName: this.stringValue(match?.map_name) ?? "",
        outcome: this.stringValue(match?.outcome),
        score: this.tupleScore(match?.score),
        finishedAt: this.stringValue(match?.finished_at),
        rating: this.finiteNumber(match?.leetify_rating)
      })).filter((match: RecentMatchSummary) => match.id)
    };
  }

  private async fetchFaceit(steamId64: string, apiKey: string, signal?: AbortSignal): Promise<FaceitData> {
    const headers = { accept: "application/json", Authorization: `Bearer ${apiKey}` };
    const playerUrl = new URL(`${FACEIT_BASE}/players`);
    playerUrl.searchParams.set("game", "cs2");
    playerUrl.searchParams.set("game_player_id", steamId64);

    let playerResponse: Response;
    try {
      playerResponse = await this.fetchImpl(playerUrl, { headers, signal });
    } catch (error) {
      return this.sourceFailure("offline", `FACEIT request failed: ${this.errorMessage(error)}`, "faceit");
    }
    if (!playerResponse.ok) return this.mapFailure("FACEIT", playerResponse.status, "faceit");

    const player = await this.safeJson(playerResponse) as any;
    const playerId = this.stringValue(player?.player_id);
    if (!playerId) return this.sourceFailure("unavailable", "FACEIT returned an invalid player response", "faceit");
    const game = player?.games?.cs2 ?? {};

    const [statsResult, historyResult] = await Promise.all([
      this.faceitJson(`${FACEIT_BASE}/players/${encodeURIComponent(playerId)}/stats/cs2`, headers, signal),
      this.faceitJson(`${FACEIT_BASE}/players/${encodeURIComponent(playerId)}/history?game=cs2&limit=5`, headers, signal)
    ]);

    const lifetime = statsResult.ok ? (statsResult.body as any)?.lifetime ?? {} : {};
    const history = historyResult.ok ? this.array((historyResult.body as any)?.items) : [];
    const recentMatches = history.map((match: any) => this.normalizeFaceitHistory(match, playerId));
    const wins = recentMatches.filter((match) => match.outcome === "WIN").length;
    const losses = recentMatches.filter((match) => match.outcome === "LOSS").length;

    return {
      status: "ready",
      playerId,
      nickname: this.stringValue(player?.nickname),
      profileUrl: this.normalizeFaceitUrl(this.stringValue(player?.faceit_url)),
      elo: this.finiteNumber(game?.faceit_elo),
      level: this.finiteNumber(game?.skill_level),
      region: this.stringValue(game?.region),
      kd: this.objectNumber(lifetime, ["Average K/D Ratio", "K/D Ratio", "K/D"]),
      hsPercent: this.objectNumber(lifetime, ["Average Headshots %", "Headshots %"]),
      winRate: this.objectNumber(lifetime, ["Win Rate %", "Win Rate"]),
      recentRecord: history.length ? { wins, losses } : undefined,
      recentMatches,
      message: (!statsResult.ok || !historyResult.ok) ? "Some FACEIT detail endpoints were unavailable" : undefined
    };
  }

  private async faceitJson(url: string, headers: Record<string, string>, signal?: AbortSignal): Promise<{ ok: boolean; body?: unknown }> {
    try {
      const response = await this.fetchImpl(url, { headers, signal });
      return { ok: response.ok, body: response.ok ? await this.safeJson(response) : undefined };
    } catch {
      return { ok: false };
    }
  }

  private normalizeFaceitHistory(match: any, playerId: string): RecentMatchSummary {
    const teams = match?.teams && typeof match.teams === "object" ? Object.entries(match.teams) : [];
    const playerTeam = teams.find(([, team]: [string, any]) => this.array(team?.roster).some((member: any) => member?.player_id === playerId));
    const teamKey = playerTeam?.[0];
    const winner = this.stringValue(match?.results?.winner);
    const outcome = teamKey && winner ? (teamKey === winner ? "WIN" : "LOSS") : undefined;
    const scoreObject = match?.results?.score;
    const score = teamKey && scoreObject && typeof scoreObject === "object" ? this.formatScoreObject(scoreObject, teamKey) : undefined;
    return {
      id: this.stringValue(match?.match_id) ?? "",
      source: "faceit",
      mapName: "",
      outcome,
      score,
      finishedAt: this.epochSecondsToIso(this.finiteNumber(match?.finished_at))
    };
  }

  private mapFailure(provider: string, status: number, source: "leetify" | "faceit"): any {
    if (status === 404) return this.sourceFailure("not_found", `${provider} profile not found`, source);
    if (status === 403) return this.sourceFailure("private", `${provider} profile is unavailable or private`, source);
    if (status === 429) return this.sourceFailure("rate_limited", `${provider} rate limit reached for your API key`, source);
    if (status === 401) return this.sourceFailure("unavailable", `${provider} API key was rejected`, source);
    if (status >= 500) return this.sourceFailure("offline", `${provider} is temporarily unavailable`, source);
    return this.sourceFailure("unavailable", `${provider} request failed (${status})`, source);
  }

  private sourceFailure(status: OnlineSourceStatus, message: string, source: "leetify" | "faceit"): LeetifyData | FaceitData {
    return source === "leetify"
      ? { status, message, competitiveRanks: [], recentMatches: [] }
      : { status, message, recentMatches: [] };
  }

  private competitiveRankLabel(rank: number | undefined): string | undefined {
    return Number.isInteger(rank) && rank !== undefined && rank >= 1 && rank <= 18 ? COMPETITIVE_RANKS[rank] : undefined;
  }

  private tupleScore(value: unknown): string | undefined {
    return Array.isArray(value) && value.length >= 2 && this.finiteNumber(value[0]) !== undefined && this.finiteNumber(value[1]) !== undefined
      ? `${this.finiteNumber(value[0])}-${this.finiteNumber(value[1])}`
      : undefined;
  }

  private objectNumber(object: any, keys: string[]): number | undefined {
    for (const key of keys) {
      const value = this.finiteNumber(object?.[key]);
      if (value !== undefined) return value;
    }
    return undefined;
  }

  private finiteNumber(value: unknown): number | undefined {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value.replace("%", ""));
      if (Number.isFinite(parsed)) return parsed;
    }
    return undefined;
  }

  private stringValue(value: unknown): string | undefined {
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
  }

  private array(value: unknown): any[] {
    return Array.isArray(value) ? value : [];
  }

  private epochSecondsToIso(value: number | undefined): string | undefined {
    if (value === undefined) return undefined;
    try { return new Date(value * 1000).toISOString(); } catch { return undefined; }
  }

  private formatScoreObject(scoreObject: Record<string, unknown>, ownKey: string): string | undefined {
    const entries = Object.entries(scoreObject).filter(([, value]) => this.finiteNumber(value) !== undefined);
    const own = entries.find(([key]) => key === ownKey);
    const opponent = entries.find(([key]) => key !== ownKey);
    return own && opponent ? `${this.finiteNumber(own[1])}-${this.finiteNumber(opponent[1])}` : undefined;
  }

  private normalizeFaceitUrl(value: string | undefined): string | undefined {
    return value?.replace("{lang}", "en");
  }

  private async safeJson(response: Response): Promise<unknown> {
    try { return await response.json(); } catch { return undefined; }
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
