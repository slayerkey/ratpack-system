const LEETIFY_BASE = "https://api-public.cs-prod.leetify.com";
const FACEIT_BASE = "https://open.faceit.com/data/v4";
const STEAM_COMMUNITY_BASE = "https://steamcommunity.com";
const STEAM64_RE = /^7656119\d{10}$/;
const MAX_IDENTITY_LENGTH = 256;

const COMPETITIVE_RANKS = [
  undefined,
  "Silver I", "Silver II", "Silver III", "Silver IV", "Silver Elite", "Silver Elite Master",
  "Gold Nova I", "Gold Nova II", "Gold Nova III", "Gold Nova Master",
  "Master Guardian I", "Master Guardian II", "Master Guardian Elite", "Distinguished Master Guardian",
  "Legendary Eagle", "Legendary Eagle Master", "Supreme Master First Class", "Global Elite"
];

export default {
  async fetch(request, env) {
    return handleRequest(request, env, fetch);
  }
};

export async function handleRequest(request, env = {}, fetchImpl = fetch) {
  const url = new URL(request.url);
  if (request.method !== "GET") return json({ error: "Method not allowed" }, 405, { Allow: "GET" });

  if (url.pathname === "/health") {
    return json({ ok: true, service: "packrat-cs2-provider-gateway", version: 1 });
  }

  if (url.pathname !== "/v1/cs2/profile") return json({ error: "Not found" }, 404);

  const identity = (url.searchParams.get("steam") ?? "").trim();
  if (!identity || identity.length > MAX_IDENTITY_LENGTH) return json({ error: "A valid Steam profile or SteamID64 is required" }, 400);

  let steamId64;
  try {
    steamId64 = await resolveSteamIdentity(identity, fetchImpl);
  } catch (error) {
    return json({ error: errorMessage(error) }, error?.status ?? 400);
  }

  const [leetify, faceit] = await Promise.all([
    fetchLeetify(steamId64, env, fetchImpl),
    fetchFaceit(steamId64, env, fetchImpl)
  ]);

  const displayName = faceit.nickname || leetify.name;
  return json({
    requestedIdentity: identity,
    steamId64,
    displayName,
    updatedAt: Date.now(),
    refreshing: false,
    leetify: stripInternal(leetify),
    faceit: stripInternal(faceit)
  });
}

export async function resolveSteamIdentity(identity, fetchImpl = fetch) {
  if (STEAM64_RE.test(identity)) return identity;

  let parsed;
  try {
    parsed = new URL(identity);
  } catch {
    parsed = undefined;
  }

  if (parsed && /(^|\.)steamcommunity\.com$/i.test(parsed.hostname)) {
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts[0]?.toLowerCase() === "profiles" && STEAM64_RE.test(parts[1] ?? "")) return parts[1];
    if (parts[0]?.toLowerCase() === "id" && parts[1]) return resolveVanity(parts[1], fetchImpl);
  }

  if (/^[A-Za-z0-9_-]{2,64}$/.test(identity)) return resolveVanity(identity, fetchImpl);
  throw statusError("Steam identity format is not supported", 400);
}

async function resolveVanity(vanity, fetchImpl) {
  // Steam community profile XML exposes steamID64 for public vanity URLs and
  // avoids making every PackRat install depend on a separate Steam Web API key.
  const url = new URL(`/id/${encodeURIComponent(vanity)}/`, STEAM_COMMUNITY_BASE);
  url.searchParams.set("xml", "1");

  let response;
  try {
    response = await fetchImpl(url, {
      method: "GET",
      headers: {
        accept: "application/xml,text/xml;q=0.9,text/plain;q=0.8",
        "user-agent": "PackRat-CS2-Competitive-Dashboard/1.0"
      },
      redirect: "follow"
    });
  } catch (error) {
    throw statusError(`Steam identity lookup failed: ${errorMessage(error)}`, 502);
  }

  if (!response.ok) {
    throw statusError(
      response.status === 404 ? "Steam vanity profile was not found" : `Steam identity lookup failed (${response.status})`,
      response.status === 404 ? 404 : response.status === 429 ? 429 : 502
    );
  }

  const xml = await response.text();
  const steamId = xml.match(/<steamID64>\s*(7656119\d{10})\s*<\/steamID64>/i)?.[1];
  if (!STEAM64_RE.test(steamId ?? "")) throw statusError("Steam vanity profile did not expose a valid SteamID64", 404);
  return steamId;
}

export async function fetchLeetify(steamId64, env, fetchImpl = fetch) {
  const url = new URL(`${LEETIFY_BASE}/v3/profile`);
  url.searchParams.set("steam64_id", steamId64);
  const headers = { accept: "application/json" };
  if (env.LEETIFY_API_KEY) headers.Authorization = `Bearer ${env.LEETIFY_API_KEY}`;

  let response;
  try {
    response = await fetchImpl(url, { headers });
  } catch (error) {
    return sourceFailure("offline", `Leetify request failed: ${errorMessage(error)}`, "leetify");
  }

  if (!response.ok) return mapProviderFailure("Leetify", response.status, "leetify");
  const body = await safeJson(response);
  if (!body || typeof body !== "object") return sourceFailure("unavailable", "Leetify returned an invalid response", "leetify");

  return {
    status: "ready",
    name: stringValue(body.name),
    profileUrl: `https://leetify.com/app/profile/${encodeURIComponent(steamId64)}`,
    premier: finiteNumber(body.ranks?.premier),
    winRate: finiteNumber(body.winrate),
    totalMatches: finiteNumber(body.total_matches),
    competitiveRanks: array(body.ranks?.competitive).map((rank) => ({
      mapName: stringValue(rank?.map_name) ?? "",
      rank: finiteNumber(rank?.rank) ?? 0,
      rankLabel: competitiveRankLabel(finiteNumber(rank?.rank))
    })).filter((rank) => rank.mapName && rank.rank > 0),
    recentMatches: array(body.recent_matches).slice(0, 10).map((match) => ({
      id: stringValue(match?.id) ?? "",
      source: stringValue(match?.data_source) ?? "leetify",
      mapName: stringValue(match?.map_name) ?? "",
      outcome: stringValue(match?.outcome),
      score: tupleScore(match?.score),
      finishedAt: stringValue(match?.finished_at),
      rating: finiteNumber(match?.leetify_rating)
    })).filter((match) => match.id),
    recentMatchesRaw: undefined
  };
}

export async function fetchFaceit(steamId64, env, fetchImpl = fetch) {
  if (!env.FACEIT_API_KEY) {
    return {
      status: "unavailable",
      message: "FACEIT provider is not configured on the RatPack gateway",
      recentMatches: []
    };
  }

  const headers = { accept: "application/json", Authorization: `Bearer ${env.FACEIT_API_KEY}` };
  const playerUrl = new URL(`${FACEIT_BASE}/players`);
  playerUrl.searchParams.set("game", "cs2");
  playerUrl.searchParams.set("game_player_id", steamId64);

  let playerResponse;
  try {
    playerResponse = await fetchImpl(playerUrl, { headers });
  } catch (error) {
    return sourceFailure("offline", `FACEIT request failed: ${errorMessage(error)}`, "faceit");
  }
  if (!playerResponse.ok) return mapProviderFailure("FACEIT", playerResponse.status, "faceit");

  const player = await safeJson(playerResponse);
  const playerId = stringValue(player?.player_id);
  if (!playerId) return sourceFailure("unavailable", "FACEIT returned an invalid player response", "faceit");
  const game = player?.games?.cs2 ?? {};

  const [statsResult, historyResult] = await Promise.all([
    faceitJson(`${FACEIT_BASE}/players/${encodeURIComponent(playerId)}/stats/cs2`, headers, fetchImpl),
    faceitJson(`${FACEIT_BASE}/players/${encodeURIComponent(playerId)}/history?game=cs2&limit=5`, headers, fetchImpl)
  ]);

  const lifetime = statsResult.ok ? statsResult.body?.lifetime ?? {} : {};
  const history = historyResult.ok ? array(historyResult.body?.items) : [];
  const recentMatches = history.map((match) => normalizeFaceitHistory(match, playerId));
  const wins = recentMatches.filter((match) => match.outcome === "WIN").length;
  const losses = recentMatches.filter((match) => match.outcome === "LOSS").length;

  return {
    status: "ready",
    playerId,
    nickname: stringValue(player?.nickname),
    profileUrl: normalizeFaceitUrl(stringValue(player?.faceit_url)),
    elo: finiteNumber(game?.faceit_elo),
    level: finiteNumber(game?.skill_level),
    region: stringValue(game?.region),
    kd: objectNumber(lifetime, ["Average K/D Ratio", "K/D Ratio", "K/D"]),
    hsPercent: objectNumber(lifetime, ["Average Headshots %", "Headshots %"]),
    winRate: objectNumber(lifetime, ["Win Rate %", "Win Rate"]),
    recentRecord: history.length ? { wins, losses } : undefined,
    recentMatches,
    message: (!statsResult.ok || !historyResult.ok) ? "Some FACEIT detail endpoints were unavailable" : undefined
  };
}

async function faceitJson(url, headers, fetchImpl) {
  try {
    const response = await fetchImpl(url, { headers });
    return { ok: response.ok, status: response.status, body: response.ok ? await safeJson(response) : undefined };
  } catch {
    return { ok: false, status: 0, body: undefined };
  }
}

function normalizeFaceitHistory(match, playerId) {
  const teams = match?.teams && typeof match.teams === "object" ? Object.entries(match.teams) : [];
  const playerTeam = teams.find(([, team]) => array(team?.roster).some((member) => member?.player_id === playerId));
  const teamKey = playerTeam?.[0];
  const winner = stringValue(match?.results?.winner);
  const outcome = teamKey && winner ? (teamKey === winner ? "WIN" : "LOSS") : undefined;
  const scoreObject = match?.results?.score;
  const score = teamKey && scoreObject && typeof scoreObject === "object"
    ? formatScoreObject(scoreObject, teamKey)
    : undefined;

  return {
    id: stringValue(match?.match_id) ?? "",
    source: "faceit",
    mapName: "",
    outcome,
    score,
    finishedAt: epochSecondsToIso(finiteNumber(match?.finished_at))
  };
}

function formatScoreObject(scoreObject, ownKey) {
  const entries = Object.entries(scoreObject).filter(([, value]) => finiteNumber(value) !== undefined);
  const own = entries.find(([key]) => key === ownKey);
  const opponent = entries.find(([key]) => key !== ownKey);
  return own && opponent ? `${finiteNumber(own[1])}-${finiteNumber(opponent[1])}` : undefined;
}

function normalizeFaceitUrl(value) {
  if (!value) return undefined;
  return value.replace("{lang}", "en");
}

function mapProviderFailure(provider, status, source) {
  if (status === 404) return sourceFailure("not_found", `${provider} profile not found`, source);
  if (status === 403) return sourceFailure("private", `${provider} profile is unavailable or private`, source);
  if (status === 429) return sourceFailure("rate_limited", `${provider} rate limit reached`, source);
  if (status === 401) return sourceFailure("unavailable", `${provider} gateway credentials were rejected`, source);
  if (status >= 500) return sourceFailure("offline", `${provider} is temporarily unavailable`, source);
  return sourceFailure("unavailable", `${provider} request failed (${status})`, source);
}

function sourceFailure(status, message, source) {
  return source === "leetify"
    ? { status, message, competitiveRanks: [], recentMatches: [] }
    : { status, message, recentMatches: [] };
}

function stripInternal(value) {
  if (!value || typeof value !== "object") return value;
  const { name, recentMatchesRaw, ...publicValue } = value;
  return publicValue;
}

function competitiveRankLabel(rank) {
  return Number.isInteger(rank) && rank >= 1 && rank <= 18 ? COMPETITIVE_RANKS[rank] : undefined;
}

function tupleScore(value) {
  return Array.isArray(value) && value.length >= 2 && finiteNumber(value[0]) !== undefined && finiteNumber(value[1]) !== undefined
    ? `${finiteNumber(value[0])}-${finiteNumber(value[1])}`
    : undefined;
}

function objectNumber(object, keys) {
  for (const key of keys) {
    const value = finiteNumber(object?.[key]);
    if (value !== undefined) return value;
  }
  return undefined;
}

function finiteNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value.replace("%", ""));
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function stringValue(value) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function epochSecondsToIso(value) {
  if (value === undefined) return undefined;
  try { return new Date(value * 1000).toISOString(); } catch { return undefined; }
}

async function safeJson(response) {
  try { return await response.json(); } catch { return undefined; }
}

function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store, max-age=0",
      "x-content-type-options": "nosniff",
      ...extraHeaders
    }
  });
}

function statusError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
