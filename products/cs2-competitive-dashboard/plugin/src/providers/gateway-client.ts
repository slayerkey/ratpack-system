import { emptyOnlineSnapshot, type OnlineProfileSnapshot } from "./types.js";

export class GatewayError extends Error {
  constructor(
    message: string,
    public readonly status?: number
  ) {
    super(message);
    this.name = "GatewayError";
  }
}

export class GatewayClient {
  private readonly baseUrl: string;

  constructor(
    baseUrl: string,
    private readonly fetchImpl: typeof fetch = fetch
  ) {
    this.baseUrl = baseUrl.trim().replace(/\/+$/, "");
  }

  get configured(): boolean {
    return this.baseUrl.length > 0;
  }

  async getProfile(steamIdentity: string, signal?: AbortSignal): Promise<OnlineProfileSnapshot> {
    const identity = steamIdentity.trim();
    if (!identity) return emptyOnlineSnapshot();
    if (!this.configured) {
      const snapshot = emptyOnlineSnapshot(identity);
      snapshot.error = "RatPack online provider gateway is not configured in this build";
      snapshot.leetify.message = snapshot.error;
      snapshot.faceit.message = snapshot.error;
      return snapshot;
    }

    const url = new URL(`${this.baseUrl}/v1/cs2/profile`);
    url.searchParams.set("steam", identity);

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: "GET",
        headers: { accept: "application/json" },
        signal
      });
    } catch (error) {
      throw new GatewayError(error instanceof Error ? error.message : "Network request failed");
    }

    const body = await this.readJson(response);
    if (!response.ok) {
      const message = this.errorFrom(body) ?? `Online provider request failed (${response.status})`;
      throw new GatewayError(message, response.status);
    }

    return this.validateProfile(body, identity);
  }

  private async readJson(response: Response): Promise<unknown> {
    try {
      return await response.json();
    } catch {
      return undefined;
    }
  }

  private errorFrom(body: unknown): string | undefined {
    if (!body || typeof body !== "object") return undefined;
    const candidate = body as Record<string, unknown>;
    return typeof candidate.error === "string" ? candidate.error : undefined;
  }

  private validateProfile(body: unknown, identity: string): OnlineProfileSnapshot {
    if (!body || typeof body !== "object") throw new GatewayError("Gateway returned an invalid profile payload");
    const candidate = body as Partial<OnlineProfileSnapshot>;
    if (!candidate.leetify || !candidate.faceit) throw new GatewayError("Gateway profile payload is missing source state");

    return {
      requestedIdentity: candidate.requestedIdentity ?? identity,
      steamId64: candidate.steamId64,
      displayName: candidate.displayName,
      updatedAt: typeof candidate.updatedAt === "number" ? candidate.updatedAt : Date.now(),
      refreshing: false,
      error: candidate.error,
      leetify: {
        ...candidate.leetify,
        competitiveRanks: Array.isArray(candidate.leetify.competitiveRanks) ? candidate.leetify.competitiveRanks : [],
        recentMatches: Array.isArray(candidate.leetify.recentMatches) ? candidate.leetify.recentMatches : []
      },
      faceit: {
        ...candidate.faceit,
        recentMatches: Array.isArray(candidate.faceit.recentMatches) ? candidate.faceit.recentMatches : []
      }
    };
  }
}
