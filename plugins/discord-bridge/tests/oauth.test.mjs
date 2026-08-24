import assert from "node:assert/strict";
import test from "node:test";
import { DiscordOAuthFlow } from "../src/oauth.js";

const CLIENT_ID = "1540927508302536724";
const flow = () => new DiscordOAuthFlow({ clientId: CLIENT_ID, pluginUUID: "com.packrat.discord-bridge", scopes: ["rpc.voice.read", "rpc.voice.write"] });

test("OAuth authorization creates PKCE request and restart-safe pending state", () => {
  const attempt = flow().createAuthorization();
  const url = new URL(attempt.url);
  assert.equal(url.origin, "https://discord.com");
  assert.equal(url.pathname, "/oauth2/authorize");
  assert.equal(url.searchParams.get("client_id"), CLIENT_ID);
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.match(url.searchParams.get("code_challenge"), /^[A-Za-z0-9_-]{40,}$/);
  assert.equal(url.searchParams.get("state"), attempt.pending.state);
  assert.match(attempt.pending.verifier, /^[A-Za-z0-9_-]{40,}$/);
  assert.ok(!attempt.url.includes(attempt.pending.verifier));
});

test("OAuth callback can complete from persisted pending state without a client secret", async () => {
  const oauth = flow();
  const attempt = oauth.createAuthorization();
  const originalFetch = globalThis.fetch;
  let body = "";
  globalThis.fetch = async (_url, options) => {
    body = String(options?.body || "");
    return new Response(JSON.stringify({ access_token: "test-token", refresh_token: "refresh", expires_in: 100, scope: "rpc.voice.read rpc.voice.write" }), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    const token = await oauth.completeAuthorization(`/auth?code=abc123&state=${encodeURIComponent(attempt.pending.state)}`, JSON.parse(JSON.stringify(attempt.pending)));
    assert.equal(token.accessToken, "test-token");
    const params = new URLSearchParams(body);
    assert.equal(params.get("client_id"), CLIENT_ID);
    assert.equal(params.get("code"), "abc123");
    assert.equal(params.get("code_verifier"), attempt.pending.verifier);
    assert.equal(params.get("client_secret"), null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("OAuth callback rejects state mismatch before token exchange", async () => {
  const oauth = flow();
  const attempt = oauth.createAuthorization();
  await assert.rejects(() => oauth.completeAuthorization("/auth?code=abc&state=wrong", attempt.pending), /state did not match/);
});

test("RPC authorization code exchange attempts Public Client flow without a client secret", async () => {
  const oauth = flow();
  const originalFetch = globalThis.fetch;
  let requestUrl = "";
  let body = "";
  globalThis.fetch = async (url, options) => {
    requestUrl = String(url);
    body = String(options?.body || "");
    return new Response(JSON.stringify({ access_token: "rpc-test-token", expires_in: 100, scope: "rpc.voice.read rpc.voice.write" }), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    const token = await oauth.exchangeRpcCode("rpc-code-123", "http://127.0.0.1");
    assert.equal(token.accessToken, "rpc-test-token");
    assert.equal(requestUrl, "https://discord.com/api/oauth2/token");
    const params = new URLSearchParams(body);
    assert.equal(params.get("grant_type"), "authorization_code");
    assert.equal(params.get("client_id"), CLIENT_ID);
    assert.equal(params.get("code"), "rpc-code-123");
    assert.equal(params.get("redirect_uri"), "http://127.0.0.1");
    assert.equal(params.get("client_secret"), null);
    assert.equal(params.get("code_verifier"), null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
