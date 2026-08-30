export const STREAMKIT_CLIENT_ID = "207646673902501888";
export const STREAMKIT_RPC_SCOPES = ["rpc", "rpc.voice.read", "rpc.voice.write"];
export const STREAMKIT_TOKEN_URL = "https://streamkit.discord.com/overlay/token";

export async function exchangeStreamKitCode(code, { fetchImpl = fetch, timeoutMs = 10000 } = {}) {
  const authorizationCode = String(code || "").trim();
  if (!authorizationCode) throw new Error("StreamKit authorization code is missing");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(STREAMKIT_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: authorizationCode }),
      signal: controller.signal,
    });
    let body = null;
    try { body = await response.json(); } catch { body = null; }
    if (!response.ok) {
      const detail = body?.message || body?.error_description || body?.error || `HTTP ${response.status}`;
      throw new Error(`StreamKit token exchange failed: ${detail}`);
    }
    const accessToken = String(body?.access_token || "");
    if (!accessToken) throw new Error("StreamKit token exchange returned no access token");
    return { accessToken };
  } finally {
    clearTimeout(timer);
  }
}
