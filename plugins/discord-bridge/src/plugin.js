import streamDeck, { SingletonAction } from "@elgato/streamdeck";
import { DiscordIpcClient } from "./discord-ipc.js";
import { LocalBridgeServer } from "./local-bridge.js";
import {
  STREAMKIT_CLIENT_ID,
  STREAMKIT_RPC_SCOPES,
  exchangeStreamKitCode,
} from "./streamkit-rpc.js";

const STATUS_ACTION = "com.packrat.discord-bridge.status";
const BRIDGE_PORT = 17483;
const BUILD_VERSION = "1.0.0.0";

const model = {
  ok: true,
  protocol: 3,
  buildVersion: BUILD_VERSION,
  updatedAt: new Date().toISOString(),
  bridge: { port: BRIDGE_PORT, listening: false, clients: 0 },
  discord: {
    connected: false,
    ready: false,
    authenticated: false,
    pipe: null,
    rpcVersion: null,
    handshake: "idle",
    lastHandshakeError: null,
  },
  streamkit: {
    mode: "public_rpc",
    stage: "idle",
    clientId: STREAMKIT_CLIENT_ID,
    tokenCached: false,
    tokenPersistence: "memory_only",
    lastError: null,
  },
  account: null,
  channel: null,
  voice: { mute: false, deaf: false },
  speaking: {},
  scopes: [],
  error: null,
};

function snapshot() {
  return JSON.parse(JSON.stringify(model));
}

function touch() {
  model.updatedAt = new Date().toISOString();
}

const discord = new DiscordIpcClient(STREAMKIT_CLIENT_ID);
const bridge = new LocalBridgeServer({ port: BRIDGE_PORT, snapshot });
const statusActions = new Map();

let reconnectTimer = null;
let channelSubscriptionId = null;
let authorizing = false;
let sessionAccessToken = "";

function logError(error) {
  try {
    streamDeck.logger.error(String(error?.stack || error?.message || error));
  } catch {
    // Stream Deck may already be shutting down.
  }
}

function statusTitle() {
  if (!model.bridge.listening) return "Bridge\nStarting";
  if (!model.discord.connected || !model.discord.ready) return "Open\nDiscord";
  if (model.streamkit.stage === "authorizing") return "Authorize\nin Discord";
  if (["exchanging", "authenticating"].includes(model.streamkit.stage)) return "Finishing\nSetup";
  if (model.streamkit.stage === "failed") return "Auth\nNeeds Help";
  if (!model.discord.authenticated) return "Press to\nAuthorize";
  if (model.channel?.name) return String(model.channel.name).slice(0, 18);
  return "Discord\nReady";
}

async function updateAllTitles(title) {
  const writes = [];
  for (const action of statusActions.values()) {
    writes.push(action.setTitle(title).catch(logError));
  }
  await Promise.all(writes);
}

function publish() {
  touch();
  model.bridge.clients = bridge.clients?.size || 0;
  void updateAllTitles(statusTitle());
  bridge.broadcastSnapshot();
}

function setError(error) {
  model.error = error ? String(error?.message || error) : null;
  if (error) logError(error);
  publish();
}

function setStage(stage, error = null) {
  model.streamkit.stage = stage;
  model.streamkit.lastError = error ? String(error?.message || error) : null;
  if (error) {
    model.error = model.streamkit.lastError;
    logError(error);
  }
  publish();
}

function clearSessionToken() {
  sessionAccessToken = "";
  model.streamkit.tokenCached = false;
}

function currentVoiceStates() {
  return Array.isArray(model.channel?.voice_states) ? model.channel.voice_states : [];
}

function memberId(entry) {
  return String(entry?.user?.id || entry?.user_id || "");
}

function mergeVoiceState(existing, incoming) {
  if (!existing) return incoming;
  if (!incoming || typeof incoming !== "object") return existing;

  const next = { ...existing, ...incoming };
  if (existing.user || incoming.user) {
    next.user = { ...(existing.user || {}), ...(incoming.user || {}) };
  }
  if (existing.voice_state || incoming.voice_state) {
    next.voice_state = { ...(existing.voice_state || {}), ...(incoming.voice_state || {}) };
  }
  return next;
}

function upsertVoiceState(raw) {
  if (!model.channel) return;
  if (!Array.isArray(model.channel.voice_states)) model.channel.voice_states = [];
  const id = memberId(raw);
  if (!id) return;
  const index = model.channel.voice_states.findIndex((entry) => memberId(entry) === id);
  if (index >= 0) model.channel.voice_states[index] = mergeVoiceState(model.channel.voice_states[index], raw);
  else model.channel.voice_states.push(raw);
}

function removeVoiceState(raw) {
  if (!model.channel || !Array.isArray(model.channel.voice_states)) return;
  const id = memberId(raw);
  if (!id) return;
  model.channel.voice_states = model.channel.voice_states.filter((entry) => memberId(entry) !== id);
  delete model.speaking[id];
}

async function setChannelSubscriptions(channelId) {
  if (channelSubscriptionId === channelId) return;

  if (channelSubscriptionId) {
    const args = { channel_id: channelSubscriptionId };
    await Promise.allSettled([
      discord.unsubscribe("VOICE_STATE_CREATE", args),
      discord.unsubscribe("VOICE_STATE_UPDATE", args),
      discord.unsubscribe("VOICE_STATE_DELETE", args),
      discord.unsubscribe("SPEAKING_START", args),
      discord.unsubscribe("SPEAKING_STOP", args),
    ]);
  }

  channelSubscriptionId = channelId || null;
  if (!channelSubscriptionId) return;

  const args = { channel_id: channelSubscriptionId };
  await Promise.all([
    discord.subscribe("VOICE_STATE_CREATE", args),
    discord.subscribe("VOICE_STATE_UPDATE", args),
    discord.subscribe("VOICE_STATE_DELETE", args),
    discord.subscribe("SPEAKING_START", args),
    discord.subscribe("SPEAKING_STOP", args),
  ]);
}

async function refreshSelectedChannel() {
  if (!model.discord.authenticated) return;

  try {
    const channel = await discord.request("GET_SELECTED_VOICE_CHANNEL", {});
    model.channel = channel?.id ? channel : null;
    model.speaking = {};

    for (const entry of currentVoiceStates()) {
      const id = memberId(entry);
      if (id) model.speaking[id] = false;
    }

    await setChannelSubscriptions(model.channel?.id ? String(model.channel.id) : null);
  } catch (error) {
    const text = String(error?.message || error);
    if (/selected voice channel|not in a voice|no voice/i.test(text)) {
      model.channel = null;
      model.speaking = {};
      await setChannelSubscriptions(null);
    } else {
      throw error;
    }
  }

  publish();
}

async function refreshVoiceSettings() {
  if (!model.discord.authenticated) return;
  const voice = await discord.request("GET_VOICE_SETTINGS", {});
  if (voice && typeof voice.mute === "boolean") model.voice.mute = voice.mute;
  if (voice && typeof voice.deaf === "boolean") model.voice.deaf = voice.deaf;
  publish();
}

async function bootstrapAuthenticated() {
  await Promise.all([
    discord.subscribe("VOICE_CHANNEL_SELECT", {}),
    discord.subscribe("VOICE_SETTINGS_UPDATE", {}),
  ]);
  await Promise.all([refreshVoiceSettings(), refreshSelectedChannel()]);
}

async function authenticateToken(token, { clearOnFailure = false } = {}) {
  try {
    setStage("authenticating");
    const auth = await discord.request("AUTHENTICATE", { access_token: token });
    const scopes = Array.isArray(auth?.scopes) ? auth.scopes : [];

    for (const required of ["rpc.voice.read", "rpc.voice.write"]) {
      if (!scopes.includes(required)) {
        throw new Error(`StreamKit token did not grant ${required}`);
      }
    }

    model.discord.authenticated = true;
    model.account = auth?.user || null;
    model.scopes = scopes;
    model.error = null;
    model.streamkit.lastError = null;
    model.streamkit.stage = "ready";
    publish();
    await bootstrapAuthenticated();
    return true;
  } catch (error) {
    model.discord.authenticated = false;
    model.account = null;
    model.scopes = [];
    if (clearOnFailure) clearSessionToken();
    setStage("authorization_required", error);
    return false;
  }
}

async function beginAuthorization() {
  if (authorizing) return;

  if (!model.discord.ready) {
    await connectDiscord();
    if (!model.discord.ready) return;
  }

  authorizing = true;
  model.error = null;
  model.streamkit.lastError = null;

  try {
    setStage("authorizing");
    const authorization = await discord.request(
      "AUTHORIZE",
      {
        client_id: STREAMKIT_CLIENT_ID,
        scopes: STREAMKIT_RPC_SCOPES,
        prompt: "none",
      },
      null,
      120000,
    );

    if (!authorization?.code) {
      throw new Error("Discord StreamKit authorization returned no code");
    }

    setStage("exchanging");
    const token = await exchangeStreamKitCode(authorization.code);
    sessionAccessToken = String(token.accessToken || "");
    if (!sessionAccessToken) throw new Error("Discord StreamKit token exchange returned no access token");

    const ok = await authenticateToken(sessionAccessToken, { clearOnFailure: true });
    if (!ok) {
      throw new Error(model.streamkit.lastError || "Discord StreamKit authentication failed");
    }

    setStage("ready");
  } catch (error) {
    model.discord.authenticated = false;
    clearSessionToken();
    setStage("failed", error);
  } finally {
    authorizing = false;
  }
}

async function connectDiscord() {
  clearTimeout(reconnectTimer);
  reconnectTimer = null;

  model.discord.connected = false;
  model.discord.ready = false;
  model.discord.authenticated = false;
  model.discord.pipe = null;
  model.discord.handshake = "connecting";
  model.discord.lastHandshakeError = null;
  model.account = null;
  model.channel = null;
  model.speaking = {};
  model.scopes = [];
  publish();

  try {
    const pipe = await discord.connect();
    if (!pipe) throw new Error("Discord desktop IPC was not found");

    model.discord.connected = true;
    model.discord.ready = true;
    model.discord.pipe = pipe;
    model.discord.handshake = "ready";
    model.error = null;
    publish();

    if (sessionAccessToken) {
      await authenticateToken(sessionAccessToken, { clearOnFailure: true });
    } else {
      setStage("authorization_required");
    }

    return true;
  } catch (error) {
    model.discord.handshake = "retrying";
    model.discord.lastHandshakeError = String(error?.message || error);
    setError(error);
    reconnectTimer = setTimeout(() => {
      void connectDiscord();
    }, 5000);
    return false;
  }
}

async function setSelfVoice(field, value) {
  if (!model.discord.authenticated) {
    throw new Error("Discord voice bridge is not authenticated");
  }

  const args = {};
  args[field] = Boolean(value);
  const voice = await discord.request("SET_VOICE_SETTINGS", args);

  if (voice && typeof voice.mute === "boolean") model.voice.mute = voice.mute;
  if (voice && typeof voice.deaf === "boolean") model.voice.deaf = voice.deaf;
  publish();
}

async function handleBridgeCommand(message) {
  const command = String(message?.command || "");

  try {
    if (command === "authorize") {
      await beginAuthorization();
    } else if (command === "refresh") {
      if (!model.discord.ready) await connectDiscord();
      if (model.discord.authenticated) {
        await Promise.all([refreshVoiceSettings(), refreshSelectedChannel()]);
      }
    } else if (command === "toggle-mute") {
      await setSelfVoice("mute", !model.voice.mute);
    } else if (command === "toggle-deafen") {
      await setSelfVoice("deaf", !model.voice.deaf);
    } else if (command === "mute") {
      await setSelfVoice("mute", Boolean(message.value));
    } else if (command === "deafen") {
      await setSelfVoice("deaf", Boolean(message.value));
    }
  } catch (error) {
    setError(error);
  }
}

class BridgeStatusAction extends SingletonAction {
  manifestId = STATUS_ACTION;

  async onWillAppear(ev) {
    if (!ev.action?.isKey?.()) return;
    statusActions.set(ev.action.id, ev.action);
    await ev.action.setTitle(statusTitle());
  }

  onWillDisappear(ev) {
    statusActions.delete(ev.action?.id);
  }

  async onKeyDown(ev) {
    if (!model.discord.ready) {
      await connectDiscord();
      return;
    }

    if (!model.discord.authenticated) {
      await beginAuthorization();
      return;
    }

    await Promise.all([refreshVoiceSettings(), refreshSelectedChannel()]);
    if (ev.action?.isKey?.()) await ev.action.showOk();
  }
}

discord.on("ready", (data) => {
  model.discord.connected = true;
  model.discord.ready = true;
  model.discord.rpcVersion = data?.v ?? null;
  model.discord.handshake = "ready";
  model.discord.lastHandshakeError = null;
  model.error = null;
  publish();
});

discord.on("handshake", (info) => {
  model.discord.handshake = String(info?.stage || "unknown");
  if (info?.pipe) model.discord.pipe = String(info.pipe);
  model.discord.lastHandshakeError = info?.error ? String(info.error) : null;
  publish();
});

discord.on("dispatch", async (evt, data) => {
  try {
    if (evt === "VOICE_CHANNEL_SELECT") {
      await refreshSelectedChannel();
    } else if (evt === "VOICE_SETTINGS_UPDATE") {
      if (typeof data?.mute === "boolean") model.voice.mute = data.mute;
      if (typeof data?.deaf === "boolean") model.voice.deaf = data.deaf;
      publish();
    } else if (evt === "VOICE_STATE_CREATE" || evt === "VOICE_STATE_UPDATE") {
      upsertVoiceState(data || {});
      publish();
    } else if (evt === "VOICE_STATE_DELETE") {
      removeVoiceState(data || {});
      publish();
    } else if (evt === "SPEAKING_START" || evt === "SPEAKING_STOP") {
      const id = String(data?.user_id || "");
      if (id) model.speaking[id] = evt === "SPEAKING_START";
      publish();
    }
  } catch (error) {
    setError(error);
  }
});

discord.on("offline", () => {
  model.discord.connected = false;
  model.discord.ready = false;
  model.discord.authenticated = false;
  model.discord.pipe = null;
  model.discord.handshake = "offline";
  model.channel = null;
  model.speaking = {};
  publish();

  if (!reconnectTimer) {
    reconnectTimer = setTimeout(() => {
      void connectDiscord();
    }, 5000);
  }
});

discord.on("error", (error) => setError(error));
bridge.on("command", (message) => {
  void handleBridgeCommand(message);
});

process.on("uncaughtException", (error) => setError(error));
process.on("unhandledRejection", (error) => setError(error));

async function main() {
  streamDeck.actions.registerAction(new BridgeStatusAction());
  streamDeck.system.onSystemDidWakeUp(() => {
    void connectDiscord();
  });

  await streamDeck.connect();
  await bridge.start();
  model.bridge.listening = true;
  publish();
  await connectDiscord();
}

main().catch((error) => {
  setError(error);
  process.exitCode = 1;
});
