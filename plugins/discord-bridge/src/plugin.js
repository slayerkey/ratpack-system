import { EventEmitter } from "node:events";
import { DiscordIpcClient } from "./discord-ipc.js";
import { LocalBridgeServer } from "./local-bridge.js";
import { StreamKitEdge, normalizeStreamKitConfig } from "./streamkit-edge.js";
import { sendDiscordShortcut } from "./hotkeys.js";

const CLIENT_ID = "1540927508302536724";
const STATUS_ACTION = "com.packrat.discord-bridge.status";
const BRIDGE_PORT = 17483;
const BUILD_VERSION = "0.2.0.0";

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
    this.globalWaiters = [];
  }

  async connect() {
    if (!this.port || !this.pluginUUID || !this.registerEvent) throw new Error("Stream Deck launch arguments are missing");
    this.socket = new WebSocket(`ws://127.0.0.1:${this.port}`);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Stream Deck WebSocket connection timed out")), 5000);
      this.socket.addEventListener("open", () => {
        clearTimeout(timer);
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
      try { message = JSON.parse(String(event.data)); } catch { return; }
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
        const waiter = this.globalWaiters.shift();
        if (waiter) {
          clearTimeout(waiter.timer);
          waiter.resolve(settings);
        }
        this.emit("globalSettings", settings);
      }
    });
  }

  send(value) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return false;
    this.socket.send(JSON.stringify(value));
    return true;
  }

  setTitle(context, title) { this.send({ event: "setTitle", context, payload: { title, target: 0 } }); }
  updateAllTitles(title) { for (const context of this.contexts) this.setTitle(context, title); }
  showOk(context) { this.send({ event: "showOk", context }); }
  showAlert(context) { this.send({ event: "showAlert", context }); }
  openUrl(url) { this.send({ event: "openUrl", payload: { url } }); }
  log(message) { this.send({ event: "logMessage", payload: { message: String(message) } }); }

  getGlobalSettings(timeoutMs = 2500) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const index = this.globalWaiters.findIndex((entry) => entry.resolve === resolve);
        if (index >= 0) this.globalWaiters.splice(index, 1);
        reject(new Error("Stream Deck global settings request timed out"));
      }, timeoutMs);
      this.globalWaiters.push({ resolve, reject, timer });
      this.send({ event: "getGlobalSettings", context: this.pluginUUID });
    });
  }

  setGlobalSettings(settings) {
    this.send({ event: "setGlobalSettings", context: this.pluginUUID, payload: settings || {} });
  }
}

const model = {
  ok: true,
  protocol: 2,
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
    mode: "official_overlay_edge",
    configured: false,
    stage: "idle",
    guildId: null,
    channelId: null,
    channelLabel: null,
    pageReady: false,
    members: 0,
    lastError: null,
  },
  account: null,
  channel: null,
  voice: { mute: false, deaf: false },
  speaking: {},
  scopes: [],
  error: null,
};

function snapshot() { return JSON.parse(JSON.stringify(model)); }
function touch() { model.updatedAt = new Date().toISOString(); }

const streamDeck = new StreamDeckHost();
const discord = new DiscordIpcClient(CLIENT_ID);
const streamKit = new StreamKitEdge();
const bridge = new LocalBridgeServer({ port: BRIDGE_PORT, snapshot });
let reconnectTimer = null;
let globalSettings = {};
let streamKitConfig = null;

function statusTitle() {
  if (!model.bridge.listening) return "Bridge\nStarting";
  if (!model.discord.connected || !model.discord.ready) return "Open\nDiscord";
  if (!model.streamkit.configured) return "Setup on\nXENEON";
  if (["starting", "loading", "retrying"].includes(model.streamkit.stage)) return "Voice\nStarting";
  if (model.streamkit.stage === "failed" || model.streamkit.stage === "browser-exited") return "Voice\nNeeds Help";
  if (model.streamkit.stage === "ready") return model.channel?.name ? String(model.channel.name).slice(0, 18) : "Discord\nReady";
  return "Discord\nBridge";
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

function mapStreamKitSnapshot(data) {
  const members = Array.isArray(data?.members) ? data.members : [];
  model.streamkit.pageReady = Boolean(data?.pageReady);
  model.streamkit.members = members.length;
  model.channel = {
    id: String(data?.channel?.id || streamKitConfig?.channelId || ""),
    guild_id: String(data?.channel?.guildId || streamKitConfig?.guildId || ""),
    name: String(data?.channel?.name || streamKitConfig?.channelLabel || "Discord Voice"),
    voice_states: members.map((member) => ({
      user_id: member.id,
      nick: member.name,
      avatar_url: member.avatarUrl,
      speaking: Boolean(member.speaking),
      voice_state: { self_mute: Boolean(member.mute), self_deaf: Boolean(member.deaf) },
      user: { id: member.id, username: member.name, global_name: member.name, avatar: null },
    })),
  };
  model.speaking = Object.fromEntries(members.map((member) => [member.id, Boolean(member.speaking)]));
  if (data?.selfVoice) {
    model.voice.mute = Boolean(data.selfVoice.mute);
    model.voice.deaf = Boolean(data.selfVoice.deaf);
  }
  model.discord.authenticated = Boolean(data?.pageReady);
  model.account = members[0]
    ? { id: members[0].id, username: members[0].name, global_name: members[0].name }
    : { username: "Discord" };
  model.error = null;
  publish();
}

async function configureStreamKit(input, persist = true) {
  const config = normalizeStreamKitConfig(input);
  const same = streamKitConfig
    && streamKitConfig.guildId === config.guildId
    && streamKitConfig.channelId === config.channelId
    && streamKitConfig.channelLabel === config.channelLabel;
  streamKitConfig = config;
  model.streamkit.configured = true;
  model.streamkit.guildId = config.guildId;
  model.streamkit.channelId = config.channelId;
  model.streamkit.channelLabel = config.channelLabel;
  if (persist) {
    globalSettings = { ...globalSettings, streamkitConfig: config };
    streamDeck.setGlobalSettings(globalSettings);
  }
  publish();
  if (same && model.streamkit.stage === "ready") return true;
  return streamKit.start(config);
}

async function connectDiscordHealth() {
  clearTimeout(reconnectTimer);
  reconnectTimer = null;
  model.discord.connected = false;
  model.discord.ready = false;
  model.discord.pipe = null;
  model.discord.handshake = "connecting";
  model.discord.lastHandshakeError = null;
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
    if (streamKitConfig && model.streamkit.stage !== "ready") await streamKit.start(streamKitConfig);
    return true;
  } catch (error) {
    model.discord.handshake = "retrying";
    model.discord.lastHandshakeError = String(error?.message || error);
    setError(error);
    reconnectTimer = setTimeout(connectDiscordHealth, 5000);
    return false;
  }
}

async function toggleVoice(kind) {
  await sendDiscordShortcut(kind);
  if (kind === "mute") model.voice.mute = !model.voice.mute;
  else model.voice.deaf = !model.voice.deaf;
  publish();
  setTimeout(() => streamKit.refresh(), 250);
}

async function handleBridgeCommand(message) {
  const command = String(message?.command || "");
  try {
    if (command === "configure-streamkit") {
      await configureStreamKit({
        guildId: message.guildId,
        channelId: message.channelId,
        channelLabel: message.channelLabel,
      });
    } else if (command === "refresh") {
      if (!model.discord.ready) await connectDiscordHealth();
      if (streamKitConfig) await streamKit.refresh();
    } else if (command === "toggle-mute") {
      await toggleVoice("mute");
    } else if (command === "toggle-deafen") {
      await toggleVoice("deafen");
    } else if (command === "mute" && Boolean(message.value) !== model.voice.mute) {
      await toggleVoice("mute");
    } else if (command === "deafen" && Boolean(message.value) !== model.voice.deaf) {
      await toggleVoice("deafen");
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
  model.channel = null;
  model.speaking = {};
  publish();
  if (!reconnectTimer) reconnectTimer = setTimeout(connectDiscordHealth, 5000);
});

discord.on("error", (error) => setError(error));

streamKit.on("stage", ({ stage, error }) => {
  model.streamkit.stage = stage;
  model.streamkit.lastError = error || null;
  if (error) model.error = error;
  publish();
});
streamKit.on("snapshot", mapStreamKitSnapshot);
bridge.on("command", handleBridgeCommand);

streamDeck.on("statusAppear", (context) => streamDeck.setTitle(context, statusTitle()));
streamDeck.on("statusPress", async () => {
  if (!model.discord.ready) await connectDiscordHealth();
  else if (streamKitConfig) await streamKit.refresh();
  else streamDeck.openUrl(`http://127.0.0.1:${BRIDGE_PORT}/state`);
});
streamDeck.on("wake", connectDiscordHealth);
streamDeck.on("globalSettings", (settings) => { globalSettings = settings || {}; });

process.on("uncaughtException", setError);
process.on("unhandledRejection", setError);
process.on("exit", () => streamKit.stop());

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
  const saved = globalSettings?.streamkitConfig;
  if (saved?.guildId && saved?.channelId) {
    try {
      await configureStreamKit(saved, false);
    } catch (error) {
      setError(error);
    }
  }
  await connectDiscordHealth();
}

main().catch((error) => {
  setError(error);
  process.exitCode = 1;
});
