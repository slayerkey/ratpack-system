import crypto from "node:crypto";

function base64Url(buffer) {
  return Buffer.from(buffer)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function queryFromDeepLink(raw) {
  const value = String(raw || "");
  const queryIndex = value.indexOf("?");
  const query = queryIndex >= 0 ? value.slice(queryIndex + 1) : "";
  const hashIndex = query.indexOf("#");
  return new URLSearchParams(hashIndex >= 0 ? query.slice(0, hashIndex) : query);
}

export class DiscordOAuthFlow {
  constructor({ clientId, pluginUUID, scopes = ["rpc.voice.read", "rpc.voice.write"] }) {
    this.clientId = String(clientId);
    this.pluginUUID = String(pluginUUID);
    this.scopes = scopes.slice();
  }

  get redirectUri() {
    return `https://oauth2-redirect.elgato.com/streamdeck/plugins/message/${this.pluginUUID}/auth`;
  }

  createAuthorization() {
    const verifier = base64Url(crypto.randomBytes(48));
    const challenge = base64Url(crypto.createHash("sha256").update(verifier).digest());
    const state = base64Url(crypto.randomBytes(24));
    const createdAt = new Date().toISOString();

    const authorize = new URL("https://discord.com/oauth2/authorize");
    authorize.searchParams.set("client_id", this.clientId);
    authorize.searchParams.set("response_type", "code");
    authorize.searchParams.set("redirect_uri", this.redirectUri);
    authorize.searchParams.set("scope", this.scopes.join(" "));
    authorize.searchParams.set("code_challenge", challenge);
    authorize.searchParams.set("code_challenge_method", "S256");
    authorize.searchParams.set("state", state);
    authorize.searchParams.set("prompt", "consent");

    return {
      url: authorize.toString(),
      pending: { state, verifier, createdAt },
    };
  }

  async completeAuthorization(rawUrl, pending) {
    if (!pending || !pending.state || !pending.verifier) {
      throw new Error("OAuth callback received but the saved PKCE state is missing");
    }

    const params = queryFromDeepLink(rawUrl);
    const incomingState = params.get("state") || "";
    if (!incomingState) throw new Error("OAuth callback did not contain state");
    if (incomingState !== pending.state) throw new Error("OAuth callback state did not match the saved authorization attempt");

    const errorCode = params.get("error");
    if (errorCode) throw new Error(params.get("error_description") || errorCode);

    const code = params.get("code");
    if (!code) throw new Error("Discord returned no authorization code");

    return this.#exchangeCode(code, pending.verifier);
  }

  async #exchangeCode(code, verifier) {
    const body = new URLSearchParams();
    body.set("grant_type", "authorization_code");
    body.set("client_id", this.clientId);
    body.set("code", code);
    body.set("redirect_uri", this.redirectUri);
    body.set("code_verifier", verifier);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch("https://discord.com/api/v10/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
        cache: "no-store",
        signal: controller.signal,
      });
      const text = await response.text();
      if (!response.ok) {
        throw new Error(`Discord token exchange HTTP ${response.status}: ${text.slice(0, 300)}`);
      }
      const data = JSON.parse(text);
      if (!data.access_token) throw new Error("Discord token response had no access_token");
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || null,
        expiresIn: Number(data.expires_in || 0),
        scope: String(data.scope || ""),
      };
    } finally {
      clearTimeout(timer);
    }
  }

  async exchangeRpcCode(code, redirectUri = "http://127.0.0.1") {
    if (!code) throw new Error("Discord RPC authorization code is missing");

    const body = new URLSearchParams();
    body.set("grant_type", "authorization_code");
    body.set("client_id", this.clientId);
    body.set("code", String(code));
    body.set("redirect_uri", String(redirectUri));

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch("https://discord.com/api/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
        cache: "no-store",
        signal: controller.signal,
      });
      const text = await response.text();
      if (!response.ok) {
        throw new Error(`Discord RPC token exchange HTTP ${response.status}: ${text.slice(0, 300)}`);
      }
      const data = JSON.parse(text);
      if (!data.access_token) throw new Error("Discord RPC token response had no access_token");
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || null,
        expiresIn: Number(data.expires_in || 0),
        scope: String(data.scope || ""),
      };
    } finally {
      clearTimeout(timer);
    }
  }
}
