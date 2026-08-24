import { EventEmitter } from "node:events";
import { DiscordIpcClient } from "./discord-ipc.js";
import { LocalBridgeServer } from "./local-bridge.js";
import { DiscordOAuthFlow } from "./oauth.js";

const CLIENT_ID = "1540927508302536724";
const STATUS_ACTION = "com.packrat.discord-bridge.status";
const BRIDGE_PORT = 17483;
const SCOPES = ["rpc.voice.read", "rpc.voice.write"];
const BUILD_VERSION = "0.1.0.4";

function argValue(...names) {
  for (let index = 0; index < process.argv.length; index += 1) {
    if (!names.includes(process.argv[index])) continue;
    return process.argv[index + 1] || "";
  }
  return "";
}

class StreamDeckHost extends EventEmitter {
  constructor() {
    super();
    this.port = argValue("-port", "--port");
    this.pluginUUID = argValue("-pluginUUID", "--pluginUUID");
    this.registerEvent = argValue("-registerEvent", "--registerEvent");
    this.socket = null;
    this.contexts = new Set();
    this.connected = false;
    this.globalWaiters = new Map();
    this.requestCounter = 0;
  }

  async connect() {
    if (!this.port || !this.pluginUUID || !this.registerEvent) {
      throw new Error("Stream Deck launch arguments are missing");
    }

    const url = `ws://127.0.0.1:${this.port}`;
    this.socket = new WebSocket(url);

    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Stream Deck WebSocket connection timed out")), 5000);
      this.socket.addEventListener("open", () => {
        clearTimeout(timer);
        this.connected = true;
        this.send({ event: this.registerEvent, uuid: this.pluginUUID });
        resolve();
      }, { once: true });
      this.socket.addEventListener("error", () => {
        clearTimeout(timer);
        reject(new Error("Stream Deck WebSocket connection failed"));
      }, { once: true });
    });

    this.socket.addEventListener("message", (event) => {
      let message;
      try {
        message = JSON.parse(String(event.data));
      } catch {
        return;
      }

      if (message.event === "willAppear" && message.action === STATUS_ACTION) {
        this.contexts.add(message.context);
        this.emit("statusAppear", message.context);
      } else if (message.event === "willDisappear" && message.action === STATUS_ACTION) {
        this.contexts.delete(message.context);
      } else if (message.event === "keyDown" && message.action === STATUS_ACTION) {
        this.emit("statusPress", message.context);
      } else if (message.event === "systemDidWakeUp") {
        this.emit("wake");
      } else if (message.event === "didReceiveGlobalSettings") {
        const settings = message.payload?.settings || {};
        if (message.id && this.globalWaiters.has(message.id)) {
          const waiter = this.globalWaiters.get(message.id);
          this.globalWaiters.delete(message.id);
          clearTimeout(waiter.timer);
          waiter.resolve(settings);
        }
        this.emit("globalSettings", settings);
      } else if (message.event === "didReceiveDeepLink") {
        this.emit("deepLink", String(message.payload?.url || ""));
      }
    });

    this.socket.addEventListener("close", () => {
      this.connected = false;
      this.emit("close");
    });
  }

  send(value) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return false;
    this.socket.send(JSON.stringify(value));
    return true;
  }

  setTitle(context, title) {
    this.send({ event: "setTitle", context, payload: { title, target: 0 } });
  }

  updateAllTitles(title) {
    for (const context of this.contexts) this.setTitle(context, title);
  }

  showOk(context) {
    this.send({ event: "showOk", context });
  }

  showAlert(context) {
    this.send({ event: "showAlert", context });
  }

  openUrl(url) {
    this.send({ event: "openUrl", payload: { url } });
  }

  getGlobalSettings(timeoutMs = 2500) {
    const id = `packrat-settings-${Date.now()}-${++this.requestCounter}`;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.globalWaiters.delete(id);
        reject(new Error("Stream Deck global settings request timed out"));
      }, timeoutMs);
      this.globalWaiters.set(id, { resolve, reject, timer });
      this.send({ event: "getGlobalSettings", context: this.pluginUUID, id });
    });
  }

  setGlobalSettings(settings) {
    this.send({ event: "setGlobalSettings", context: this.pluginUUID, payload: settings || {} });
  }

  showAlertAll() {
    for (const context of this.contexts) this.showAlert(context);
  }

  showOkAll() {
    for (const context of this.contexts) this.showOk(context);
  }

  log(message) {
    this.send({ event: "logMessage", payload: { message: String(message) } });
  }
}

const model = {
  protocol: 1,
  buildVersion: BUILD_VERSION,
  updatedAt: new Date().toISOString(),
  bridge: {
    port: BRIDGE_PORT,
    listening: false,
    clients: 0,
  },
  discord: {
    connected: false,
    ready: false,
    authenticated: false,
    pipe: null,
    rpcVersion: null,
    handshake: "idle",
    lastHandshakeError: null,
  },
  account: null,
  channel: null,
  voice: {
    mute: false,
    deaf: false,
  },
  speaking: {},
  scopes: [],
  oauth: {
    mode: "discord_ipc_authorize",
    stage: "idle",
    codeReceived: false,
    tokenExchangeAttempted: false,
    tokenExchangeStatus: null,
    lastError: null,
  },
  error: null,
};

function snapshot() {
  return JSON.parse(JSON.stringify(model));
}

function touch() {
  model.updatedAt = new Date().toISOString();
}

const streamDeck = new StreamDeckHost();
const discord = new DiscordIpcClient(CLIENT_ID);
const oauth = new DiscordOAuthFlow({ clientId: CLIENT_ID, pluginUUID: "com.packrat.discord-bridge", scopes: SCOPES });
const bridge = new LocalBridgeServer({ port: BRIDGE_PORT, snapshot });

let reconnectTimer = null;
let authorizing = false;
let channelSubscriptionId = null;
let globalSettings = {};

function setOAuthStage(stage, error = null) {
  model.oauth.stage = stage;
  model.oauth.lastError = error ? String(error?.message || error) : null;
  publish();
}

function statusTitle() {
  if (!model.bridge.listening) return "Bridge\nStarting";
  if (!model.discord.connected) return "Open\nDiscord";
  if (!model.discord.ready) return "Discord\nStarting";

  if (model.oauth.stage === "rpc_authorizing") return "Authorize\nin Discord";
  if (model.oauth.stage === "rpc_code_received" || model.oauth.stage === "public_token_exchange" || model.oauth.stage === "authenticating_rpc") {
    return "Finishing\nSetup";
  }

  if (model.oauth.stage === "failed") {
    const error = String(model.oauth.lastError || model.error || "").toLowerCase();
    if (error.includes("invalid_scope") || error.includes("approved partner") || error.includes("approval")) return "Discord\nApproval";
    if (model.oauth.codeReceived && model.oauth.tokenExchangeStatus === "failed") return "Auth\nBlocked";
    return "Auth\nFailed";
  }

  if (!model.discord.authenticated) return "Press to\nAuthorize";
  if (model.channel?.name) return String(model.channel.name).slice(0, 18);
  return "Discord\nReady";
}

function publish() {
  touch();
  streamDeck.updateAllTitles(statusTitle());
  bridge.broadcastSnapshot();
}

function setError(error) {
  model.error = error ? String(error?.message || error) : null;
  publish();
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
  setError(null);

  try {
    const pipe = await discord.connect();
    if (!pipe) {
      scheduleReconnect();
      publish();
      return false;
    }
    model.discord.connected = true;
    model.discord.ready = true;
    model.discord.pipe = pipe;
    model.discord.handshake = "ready";
    publish();
    return true;
  } catch (error) {
    model.discord.connected = false;
    model.discord.ready = false;
    model.discord.handshake = "retrying";
    model.discord.lastHandshakeError = String(error?.message || error);
    setError(error);
    scheduleReconnect();
    return false;
  }
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectDiscord();
  }, 5000);
}

async function setChannelSubscriptions(channelId) {
  if (channelSubscriptionId === channelId) return;
  if (channelSubscriptionId) {
    const args = { channel_id: channelSubscriptionId };
    await Promise.all([
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
    model.channel = channel || null;
    await setChannelSubscriptions(channel?.id ? String(channel.id) : null);
    if (!channel) model.speaking = {};
  } catch (error) {
    const text = String(error?.message || error);
    if (/selected voice channel|not in a voice|no voice/i.test(text)) {
      model.channel = null;
      model.speaking = {};
      await setChannelSubscriptions(null);
    } else {
      model.channel = null;
      model.speaking = {};
    }
  }
  publish();
}

async function refreshVoiceSettings() {
  if (!model.discord.authenticated) return;
  try {
    const voice = await discord.request("GET_VOICE_SETTINGS", {});
    if (voice && typeof voice.mute === "boolean") model.voice.mute = voice.mute;
    if (voice && typeof voice.deaf === "boolean") model.voice.deaf = voice.deaf;
  } catch (error) {
    setError(error);
  }
  publish();
}

async function bootstrapAuthenticated() {
  await Promise.all([
    discord.subscribe("VOICE_CHANNEL_SELECT", {}),
    discord.subscribe("VOICE_SETTINGS_UPDATE", {}),
  ]);
  await Promise.all([refreshVoiceSettings(), refreshSelectedChannel()]);
}

async function authenticateToken(token) {
  const auth = await discord.request("AUTHENTICATE", { access_token: token });
  const scopes = Array.isArray(auth?.scopes) ? auth.scopes : [];
  for (const required of SCOPES) {
    if (!scopes.includes(required)) throw new Error(`Discord did not grant ${required}`);
  }
  model.discord.authenticated = true;
  model.account = auth?.user || null;
  model.scopes = scopes;
  setError(null);
  publish();
  await bootstrapAuthenticated();
}

async function beginAuthorization(context = null) {
  if (authorizing) return;
  if (!model.discord.ready) {
    setError("Discord IPC is not ready");
    return;
  }

  authorizing = true;
  model.oauth.lastError = null;
  model.oauth.codeReceived = false;
  model.oauth.tokenExchangeAttempted = false;
  model.oauth.tokenExchangeStatus = null;
  setError(null);

  try {
    setOAuthStage("rpc_authorizing");
    const authorization = await discord.request(
      "AUTHORIZE",
      { client_id: CLIENT_ID, scopes: SCOPES },
      null,
      120000,
    );

    if (!authorization?.code) {
      throw new Error("Discord RPC AUTHORIZE returned no authorization code");
    }

    model.oauth.codeReceived = true;
    setOAuthStage("rpc_code_received");

    model.oauth.tokenExchangeAttempted = true;
    setOAuthStage("public_token_exchange");
    const token = await oauth.exchangeRpcCode(authorization.code, "http://127.0.0.1");
    model.oauth.tokenExchangeStatus = "success";

    setOAuthStage("authenticating_rpc");
    await authenticateToken(token.accessToken);
    setOAuthStage("complete");
  } catch (error) {
    const message = String(error?.message || error);
    if (model.oauth.codeReceived && /token exchange/i.test(message)) {
      model.oauth.tokenExchangeStatus = "failed";
    }
    model.oauth.lastError = message;
    model.oauth.stage = "failed";
    setError(error);
  } finally {
    authorizing = false;
  }
}

async function setSelfVoice(field, value) {
  if (!model.discord.authenticated) throw new Error("Discord is not authenticated");
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
      if (!model.discord.connected) await connectDiscord();
      if (model.discord.authenticated) {
        await Promise.all([refreshVoiceSettings(), refreshSelectedChannel()]);
      }
    } else if (command === "mute") {
      await setSelfVoice("mute", Boolean(message.value));
    } else if (command === "deafen") {
      await setSelfVoice("deaf", Boolean(message.value));
    } else if (command === "toggle-mute") {
      await setSelfVoice("mute", !model.voice.mute);
    } else if (command === "toggle-deafen") {
      await setSelfVoice("deaf", !model.voice.deaf);
    }
  } catch (error) {
    setError(error);
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

discord.on("offline", () => {
  model.discord.connected = false;
  model.discord.ready = false;
  model.discord.authenticated = false;
  model.discord.pipe = null;
  model.discord.handshake = "offline";
  model.account = null;
  model.channel = null;
  model.speaking = {};
  model.scopes = [];
  channelSubscriptionId = null;
  publish();
  scheduleReconnect();
});

discord.on("rpcClose", ({ message }) => setError(message));
discord.on("rpcError", (data) => setError(data?.message || "Discord RPC error"));
discord.on("error", (error) => setError(error));

discord.on("dispatch", async (evt, data) => {
  try {
    if (evt === "VOICE_CHANNEL_SELECT") {
      await refreshSelectedChannel();
      return;
    }
    if (evt === "VOICE_SETTINGS_UPDATE") {
      if (typeof data?.mute === "boolean") model.voice.mute = data.mute;
      if (typeof data?.deaf === "boolean") model.voice.deaf = data.deaf;
      publish();
      return;
    }
    if (evt === "SPEAKING_START" || evt === "SPEAKING_STOP") {
      const userId = String(data?.user_id || "");
      if (userId) model.speaking[userId] = evt === "SPEAKING_START";
      publish();
      return;
    }
    if (evt === "VOICE_STATE_CREATE" || evt === "VOICE_STATE_UPDATE" || evt === "VOICE_STATE_DELETE") {
      await refreshSelectedChannel();
    }
  } catch (error) {
    setError(error);
  }
});

bridge.on("command", (message) => {
  handleBridgeCommand(message);
});

streamDeck.on("statusAppear", (context) => {
  streamDeck.setTitle(context, statusTitle());
});

streamDeck.on("statusPress", async (context) => {
  if (!model.discord.connected || !model.discord.ready) {
    await connectDiscord();
    return;
  }
  if (!model.discord.authenticated) {
    await beginAuthorization(context);
    return;
  }
  await Promise.all([refreshVoiceSettings(), refreshSelectedChannel()]);
});

streamDeck.on("wake", () => connectDiscord());

streamDeck.on("globalSettings", (settings) => {
  globalSettings = settings || {};
});

process.on("uncaughtException", (error) => setError(error));
process.on("unhandledRejection", (error) => setError(error));

async function main() {
  await streamDeck.connect();
  try {
    globalSettings = await streamDeck.getGlobalSettings();
  } catch (error) {
    streamDeck.log(`Global settings unavailable: ${String(error?.message || error)}`);
  }
  await bridge.start();
  model.bridge.listening = true;
  publish();
  await connectDiscord();
}

main().catch((error) => {
  setError(error);
  process.exitCode = 1;
});
