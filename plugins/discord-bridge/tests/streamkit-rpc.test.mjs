import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  STREAMKIT_CLIENT_ID,
  STREAMKIT_RPC_SCOPES,
  STREAMKIT_TOKEN_URL,
  exchangeStreamKitCode,
} from "../src/streamkit-rpc.js";

test("StreamKit public RPC identity and scopes are exact", () => {
  assert.equal(STREAMKIT_CLIENT_ID, "207646673902501888");
  assert.deepEqual(STREAMKIT_RPC_SCOPES, ["rpc", "rpc.voice.read", "rpc.voice.write"]);
  assert.equal(STREAMKIT_TOKEN_URL, "https://streamkit.discord.com/overlay/token");
});

test("StreamKit token exchange sends only the one time code", async () => {
  let request = null;
  const result = await exchangeStreamKitCode("one-time-code", {
    fetchImpl: async (url, options) => {
      request = { url, options };
      return {
        ok: true,
        status: 200,
        json: async () => ({ access_token: "streamkit-access-token" }),
      };
    },
  });
  assert.equal(result.accessToken, "streamkit-access-token");
  assert.equal(request.url, STREAMKIT_TOKEN_URL);
  assert.equal(request.options.method, "POST");
  assert.deepEqual(JSON.parse(request.options.body), { code: "one-time-code" });
  assert.equal(request.options.body.includes("client_secret"), false);
});

test("production plugin uses StreamKit RPC instead of the fixed channel browser fallback", async () => {
  const source = await readFile(resolve(process.cwd(), "src/plugin.js"), "utf8");
  assert.match(source, /new DiscordIpcClient\(STREAMKIT_CLIENT_ID\)/);
  assert.match(source, /"AUTHORIZE"/);
  assert.match(source, /exchangeStreamKitCode/);
  assert.match(source, /"SET_VOICE_SETTINGS"/);
  assert.match(source, /"GET_SELECTED_VOICE_CHANNEL"/);
  assert.equal(source.includes("1540927508302536724"), false);
  assert.equal(source.includes("new StreamKitEdge"), false);
  assert.equal(source.includes("sendDiscordShortcut"), false);
});
