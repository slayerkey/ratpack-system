import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import { VoiceSession } from "../src/voice-session.js";

class FakeDiscord extends EventEmitter {
  constructor() {
    super();
    this.voice = { mute: false, deaf: false };
    this.channel = {
      id: "voice-1",
      guild_id: "guild-1",
      name: "Gaming",
      voice_states: [
        { user: { id: "self", username: "me", global_name: "Me" }, voice_state: { user_id: "self", mute: false, deaf: false } },
        { user: { id: "friend", username: "friend", global_name: "Friend" }, voice_state: { user_id: "friend", mute: false, deaf: false } },
      ],
    };
    this.calls = [];
    this.disconnects = [];
  }
  async connect() { this.calls.push(["connect"]); return "\\\\?\\pipe\\discord-ipc-0"; }
  disconnect(reason) { this.disconnects.push(reason); }
  async request(cmd, args = {}, evt = null) {
    this.calls.push([cmd, args, evt]);
    if (cmd === "AUTHORIZE") return { code: "dev-code" };
    if (cmd === "AUTHENTICATE") return { user: { id: "self", username: "me" }, scopes: ["rpc", "rpc.voice.read", "rpc.voice.write"] };
    if (cmd === "GET_VOICE_SETTINGS") return { ...this.voice };
    if (cmd === "GET_SELECTED_VOICE_CHANNEL") {
      if (!this.channel) throw new Error("No selected voice channel");
      return structuredClone(this.channel);
    }
    if (cmd === "GET_GUILD") return { id: "guild-1", name: "Test Guild" };
    if (cmd === "SET_VOICE_SETTINGS") { this.voice = { ...this.voice, ...args }; return { ...this.voice }; }
    if (cmd === "SUBSCRIBE" || cmd === "UNSUBSCRIBE") return {};
    throw new Error(`Unexpected command ${cmd}`);
  }
  subscribe(evt, args = {}) { return this.request("SUBSCRIBE", args, evt); }
  unsubscribe(evt, args = {}) { return this.request("UNSUBSCRIBE", args, evt).catch(() => null); }
}

async function authenticatedSession(overrides = {}) {
  let now = 1000;
  const discord = new FakeDiscord();
  const session = new VoiceSession({ discord, now: () => now, ...overrides });
  session.sessionAccessToken = "memory-token";
  session.model.auth.tokenCached = true;
  await session.connect();
  return { session, discord, setNow: (value) => { now = value; } };
}

test("connect authenticates once, resolves real voice state and normalizes roster", async () => {
  const { session } = await authenticatedSession();
  const state = session.snapshot();
  assert.equal(state.discord.ready, true);
  assert.equal(state.discord.authenticated, true);
  assert.equal(state.guild.name, "Test Guild");
  assert.equal(state.channel.name, "Gaming");
  assert.deepEqual(state.members.map((m) => m.id), ["self", "friend"]);
});

test("mute and deafen writes round-trip through normalized state", async () => {
  const { session } = await authenticatedSession();
  await session.toggleMute();
  assert.equal(session.snapshot().voice.mute, true);
  await session.toggleDeafen();
  assert.equal(session.snapshot().voice.deaf, true);
  await session.toggleMute();
  assert.equal(session.snapshot().voice.mute, false);
});

test("roster join, leave and speaking events update without reconnecting", async () => {
  const { session, discord, setNow } = await authenticatedSession();
  discord.emit("dispatch", "VOICE_STATE_CREATE", { user: { id: "third", username: "third" }, voice_state: { user_id: "third" } });
  await new Promise((r) => setImmediate(r));
  assert.equal(session.snapshot().members.length, 3);

  setNow(2000);
  discord.emit("dispatch", "SPEAKING_START", { user_id: "friend" });
  await new Promise((r) => setImmediate(r));
  assert.equal(session.snapshot().members.find((m) => m.id === "friend").speaking, true);

  setNow(2100);
  discord.emit("dispatch", "SPEAKING_STOP", { user_id: "friend" });
  await new Promise((r) => setImmediate(r));
  assert.equal(session.snapshot().members.find((m) => m.id === "friend").recentlySpeaking, true);

  discord.emit("dispatch", "VOICE_STATE_DELETE", { user_id: "third" });
  await new Promise((r) => setImmediate(r));
  assert.equal(session.snapshot().members.some((m) => m.id === "third"), false);
});

test("voice channel changes replace roster and subscriptions", async () => {
  const { session, discord } = await authenticatedSession();
  discord.channel = {
    id: "voice-2", guild_id: "guild-1", name: "General",
    voice_states: [{ user: { id: "self", username: "me" }, voice_state: { user_id: "self" } }],
  };
  discord.emit("dispatch", "VOICE_CHANNEL_SELECT", { channel_id: "voice-2" });
  await new Promise((r) => setImmediate(r));
  await new Promise((r) => setImmediate(r));
  assert.equal(session.snapshot().channel.name, "General");
  assert.equal(session.snapshot().members.length, 1);
  assert.equal(discord.calls.some(([cmd, args, evt]) => cmd === "SUBSCRIBE" && evt === "SPEAKING_START" && args.channel_id === "voice-2"), true);
});

test("authorization flow keeps session credentials memory-only", async () => {
  const discord = new FakeDiscord();
  const session = new VoiceSession({ discord, exchangeCode: async (code) => ({ accessToken: code === "dev-code" ? "session-only" : "" }) });
  await session.connect();
  assert.equal(session.snapshot().auth.stage, "authorization_required");
  assert.equal(await session.beginAuthorization(), true);
  assert.equal(session.snapshot().discord.authenticated, true);
  assert.equal(session.sessionAccessToken, "session-only");
  assert.equal(JSON.stringify(session.snapshot()).includes("session-only"), false);
});

test("Discord restart schedules reconnect and reuses only memory session credential", async () => {
  const scheduled = [];
  const { session, discord } = await authenticatedSession({ schedule: (fn, ms) => { const item = { fn, ms }; scheduled.push(item); return item; }, cancel: () => {} });
  discord.emit("offline");
  assert.equal(session.snapshot().discord.ready, false);
  assert.equal(scheduled.length, 1);
  assert.equal(scheduled[0].ms, 4000);
  scheduled[0].fn();
  await new Promise((r) => setImmediate(r));
  await new Promise((r) => setImmediate(r));
  assert.equal(session.snapshot().discord.authenticated, true);
});
