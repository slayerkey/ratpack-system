import { EventEmitter } from "node:events";
import { DiscordIpcClient } from "./discord-ipc.js";
import { STREAMKIT_CLIENT_ID, STREAMKIT_RPC_SCOPES, exchangeStreamKitCode } from "./streamkit-rpc.js";
import { memberId, normalizeRoster, removeVoiceState, SPEAKER_HOLD_MS, upsertVoiceState } from "./model.js";

const REQUIRED_SCOPES = ["rpc.voice.read", "rpc.voice.write"];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export class VoiceSession extends EventEmitter {
  constructor({
    clientId = STREAMKIT_CLIENT_ID,
    scopes = STREAMKIT_RPC_SCOPES,
    discord = null,
    exchangeCode = exchangeStreamKitCode,
    reconnectDelayMs = 4000,
    now = () => Date.now(),
    schedule = (fn, ms) => setTimeout(fn, ms),
    cancel = (id) => clearTimeout(id),
    log = () => {},
  } = {}) {
    super();
    this.clientId = String(clientId);
    this.scopes = Array.from(scopes || []);
    this.discord = discord || new DiscordIpcClient(this.clientId);
    this.exchangeCode = exchangeCode;
    this.reconnectDelayMs = reconnectDelayMs;
    this.now = now;
    this.schedule = schedule;
    this.cancel = cancel;
    this.log = log;
    this.reconnectTimer = null;
    this.channelSubscriptionId = null;
    this.authorizing = false;
    this.connecting = false;
    this.sessionAccessToken = "";
    this.closed = false;
    this.model = {
      updatedAt: new Date(this.now()).toISOString(),
      discord: {
        connected: false,
        ready: false,
        authenticated: false,
        pipe: null,
        rpcVersion: null,
        handshake: "idle",
        lastHandshakeError: null,
      },
      auth: {
        mode: "development_streamkit",
        stage: "idle",
        clientId: this.clientId,
        tokenPersistence: "memory_only",
        tokenCached: false,
        lastError: null,
      },
      account: null,
      guild: null,
      channel: null,
      voice: { mute: false, deaf: false },
      speaking: {},
      scopes: [],
      error: null,
      lastDiscordEventAt: null,
    };
    this.#wireDiscord();
  }

  snapshot(ordering = "stable") {
    const base = clone(this.model);
    const accountId = String(base.account?.id || "");
    base.members = normalizeRoster(base.channel, base.speaking, accountId, ordering, this.now())
      .map((member) => ({ ...member, raw: undefined, self: Boolean(member.id && member.id === accountId) }));
    return base;
  }

  publish() {
    this.model.updatedAt = new Date(this.now()).toISOString();
    this.emit("state", this.snapshot());
  }

  setError(error, { auth = false } = {}) {
    const message = error ? String(error?.message || error) : null;
    this.model.error = message;
    if (auth) this.model.auth.lastError = message;
    if (message) this.log(message);
    this.publish();
  }

  setAuthStage(stage, error = null) {
    this.model.auth.stage = String(stage);
    this.model.auth.lastError = error ? String(error?.message || error) : null;
    if (error) {
      this.model.error = this.model.auth.lastError;
      this.log(this.model.auth.lastError);
    }
    this.publish();
  }

  clearToken() {
    this.sessionAccessToken = "";
    this.model.auth.tokenCached = false;
  }

  async connect() {
    if (this.closed || this.connecting) return false;
    if (this.model.discord.ready) return true;
    this.connecting = true;
    this.#clearReconnect();
    this.model.discord.connected = false;
    this.model.discord.ready = false;
    this.model.discord.authenticated = false;
    this.model.discord.pipe = null;
    this.model.discord.handshake = "connecting";
    this.model.discord.lastHandshakeError = null;
    this.model.account = null;
    this.model.guild = null;
    this.model.channel = null;
    this.model.speaking = {};
    this.model.scopes = [];
    this.model.error = null;
    this.publish();

    try {
      const pipe = await this.discord.connect();
      if (!pipe) throw new Error("Discord Desktop IPC was not found");
      this.model.discord.connected = true;
      this.model.discord.ready = true;
      this.model.discord.pipe = pipe;
      this.model.discord.handshake = "ready";
      this.model.error = null;
      this.publish();

      if (this.sessionAccessToken) {
        await this.authenticateToken(this.sessionAccessToken, { clearOnFailure: true });
      } else {
        this.setAuthStage("authorization_required");
      }
      return true;
    } catch (error) {
      this.model.discord.handshake = "retrying";
      this.model.discord.lastHandshakeError = String(error?.message || error);
      this.setError(error);
      this.#scheduleReconnect();
      return false;
    } finally {
      this.connecting = false;
    }
  }

  async beginAuthorization() {
    if (this.closed || this.authorizing) return false;
    if (!this.model.discord.ready) {
      await this.connect();
      if (!this.model.discord.ready) return false;
    }
    this.authorizing = true;
    this.model.error = null;
    this.model.auth.lastError = null;
    try {
      this.setAuthStage("authorizing");
      const authorization = await this.discord.request(
        "AUTHORIZE",
        { client_id: this.clientId, scopes: this.scopes, prompt: "none" },
        null,
        120000,
      );
      if (!authorization?.code) throw new Error("Discord authorization returned no code");
      this.setAuthStage("exchanging");
      const token = await this.exchangeCode(authorization.code);
      this.sessionAccessToken = String(token?.accessToken || "");
      if (!this.sessionAccessToken) throw new Error("Discord token exchange returned no access token");
      this.model.auth.tokenCached = true;
      const ok = await this.authenticateToken(this.sessionAccessToken, { clearOnFailure: true });
      if (!ok) throw new Error(this.model.auth.lastError || "Discord authentication failed");
      this.setAuthStage("ready");
      return true;
    } catch (error) {
      this.model.discord.authenticated = false;
      this.clearToken();
      this.setAuthStage("failed", error);
      return false;
    } finally {
      this.authorizing = false;
    }
  }

  async authenticateToken(token, { clearOnFailure = false } = {}) {
    try {
      this.setAuthStage("authenticating");
      const auth = await this.discord.request("AUTHENTICATE", { access_token: token });
      const scopes = Array.isArray(auth?.scopes) ? auth.scopes : [];
      for (const required of REQUIRED_SCOPES) {
        if (!scopes.includes(required)) throw new Error(`Discord authorization did not grant ${required}`);
      }
      this.model.discord.authenticated = true;
      this.model.account = auth?.user || null;
      this.model.scopes = scopes;
      this.model.error = null;
      this.model.auth.lastError = null;
      this.model.auth.stage = "ready";
      this.publish();
      await this.#bootstrapAuthenticated();
      return true;
    } catch (error) {
      this.model.discord.authenticated = false;
      this.model.account = null;
      this.model.scopes = [];
      if (clearOnFailure) this.clearToken();
      this.setAuthStage("authorization_required", error);
      return false;
    }
  }

  async refresh() {
    if (!this.model.discord.ready) await this.connect();
    if (!this.model.discord.authenticated) return false;
    await Promise.all([this.refreshVoiceSettings(), this.refreshSelectedChannel()]);
    return true;
  }

  async refreshVoiceSettings() {
    if (!this.model.discord.authenticated) return;
    const voice = await this.discord.request("GET_VOICE_SETTINGS", {});
    if (typeof voice?.mute === "boolean") this.model.voice.mute = voice.mute;
    if (typeof voice?.deaf === "boolean") this.model.voice.deaf = voice.deaf;
    this.#markEvent();
    this.publish();
  }

  async refreshSelectedChannel() {
    if (!this.model.discord.authenticated) return;
    try {
      const channel = await this.discord.request("GET_SELECTED_VOICE_CHANNEL", {});
      this.model.channel = channel?.id ? channel : null;
      this.model.guild = null;
      this.model.speaking = {};
      if (this.model.channel) {
        for (const entry of this.model.channel.voice_states || []) {
          const id = memberId(entry);
          if (id) this.model.speaking[id] = { active: false, lastStartAt: 0, holdUntil: 0 };
        }
      }
      await this.#setChannelSubscriptions(this.model.channel?.id ? String(this.model.channel.id) : null);
      if (this.model.channel?.guild_id) {
        try {
          this.model.guild = await this.discord.request("GET_GUILD", { guild_id: String(this.model.channel.guild_id) });
        } catch {
          this.model.guild = null;
        }
      }
    } catch (error) {
      const text = String(error?.message || error);
      if (/selected voice channel|not in a voice|no voice|channel not found/i.test(text)) {
        this.model.channel = null;
        this.model.guild = null;
        this.model.speaking = {};
        await this.#setChannelSubscriptions(null);
      } else {
        throw error;
      }
    }
    this.#markEvent();
    this.publish();
  }

  async setSelfVoice(field, value) {
    if (!this.model.discord.authenticated) throw new Error("Discord voice is not authorized");
    const args = { [field]: Boolean(value) };
    const voice = await this.discord.request("SET_VOICE_SETTINGS", args);
    if (typeof voice?.mute === "boolean") this.model.voice.mute = voice.mute;
    else if (field === "mute") this.model.voice.mute = Boolean(value);
    if (typeof voice?.deaf === "boolean") this.model.voice.deaf = voice.deaf;
    else if (field === "deaf") this.model.voice.deaf = Boolean(value);
    this.#markEvent();
    this.publish();
  }

  toggleMute() {
    return this.setSelfVoice("mute", !this.model.voice.mute);
  }

  toggleDeafen() {
    return this.setSelfVoice("deaf", !this.model.voice.deaf);
  }

  async ensureReady() {
    if (!this.model.discord.ready) await this.connect();
    if (!this.model.discord.ready) return false;
    if (!this.model.discord.authenticated) return this.beginAuthorization();
    return true;
  }

  close() {
    this.closed = true;
    this.#clearReconnect();
    this.clearToken();
    try { this.discord.disconnect("Voice Deck shutdown"); } catch {}
    this.removeAllListeners();
  }

  async #bootstrapAuthenticated() {
    await Promise.all([
      this.discord.subscribe("VOICE_CHANNEL_SELECT", {}),
      this.discord.subscribe("VOICE_SETTINGS_UPDATE", {}),
    ]);
    await Promise.all([this.refreshVoiceSettings(), this.refreshSelectedChannel()]);
  }

  async #setChannelSubscriptions(channelId) {
    if (this.channelSubscriptionId === channelId) return;
    if (this.channelSubscriptionId) {
      const args = { channel_id: this.channelSubscriptionId };
      await Promise.allSettled([
        this.discord.unsubscribe("VOICE_STATE_CREATE", args),
        this.discord.unsubscribe("VOICE_STATE_UPDATE", args),
        this.discord.unsubscribe("VOICE_STATE_DELETE", args),
        this.discord.unsubscribe("SPEAKING_START", args),
        this.discord.unsubscribe("SPEAKING_STOP", args),
      ]);
    }
    this.channelSubscriptionId = channelId || null;
    if (!this.channelSubscriptionId) return;
    const args = { channel_id: this.channelSubscriptionId };
    await Promise.all([
      this.discord.subscribe("VOICE_STATE_CREATE", args),
      this.discord.subscribe("VOICE_STATE_UPDATE", args),
      this.discord.subscribe("VOICE_STATE_DELETE", args),
      this.discord.subscribe("SPEAKING_START", args),
      this.discord.subscribe("SPEAKING_STOP", args),
    ]);
  }

  #recordSpeaking(id, active) {
    const userId = String(id || "");
    if (!userId) return;
    const stamp = this.now();
    const previous = this.model.speaking[userId] || { active: false, lastStartAt: 0, holdUntil: 0 };
    this.model.speaking[userId] = active
      ? { ...previous, active: true, lastStartAt: stamp, holdUntil: stamp + SPEAKER_HOLD_MS }
      : { ...previous, active: false, holdUntil: stamp + SPEAKER_HOLD_MS };
  }

  #markEvent() {
    this.model.lastDiscordEventAt = new Date(this.now()).toISOString();
  }

  #scheduleReconnect() {
    if (this.closed || this.reconnectTimer) return;
    this.reconnectTimer = this.schedule(() => {
      this.reconnectTimer = null;
      void this.connect();
    }, this.reconnectDelayMs);
  }

  #clearReconnect() {
    if (!this.reconnectTimer) return;
    this.cancel(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  #wireDiscord() {
    this.discord.on("ready", (data) => {
      this.model.discord.connected = true;
      this.model.discord.ready = true;
      this.model.discord.rpcVersion = data?.v ?? null;
      this.model.discord.handshake = "ready";
      this.model.discord.lastHandshakeError = null;
      this.model.error = null;
      this.#markEvent();
      this.publish();
    });
    this.discord.on("handshake", (info) => {
      this.model.discord.handshake = String(info?.stage || "unknown");
      if (info?.pipe) this.model.discord.pipe = String(info.pipe);
      this.model.discord.lastHandshakeError = info?.error ? String(info.error) : null;
      this.publish();
    });
    this.discord.on("dispatch", (evt, data) => {
      void this.#handleDispatch(evt, data).catch((error) => this.setError(error));
    });
    this.discord.on("offline", () => {
      this.model.discord.connected = false;
      this.model.discord.ready = false;
      this.model.discord.authenticated = false;
      this.model.discord.pipe = null;
      this.model.discord.handshake = "offline";
      this.model.account = null;
      this.model.guild = null;
      this.model.channel = null;
      this.model.speaking = {};
      this.model.scopes = [];
      this.model.auth.stage = this.sessionAccessToken ? "reconnecting" : "authorization_required";
      this.publish();
      this.#scheduleReconnect();
    });
    this.discord.on("error", (error) => this.setError(error));
  }

  async #handleDispatch(evt, data) {
    this.#markEvent();
    if (evt === "VOICE_CHANNEL_SELECT") {
      await this.refreshSelectedChannel();
      return;
    }
    if (evt === "VOICE_SETTINGS_UPDATE") {
      if (typeof data?.mute === "boolean") this.model.voice.mute = data.mute;
      if (typeof data?.deaf === "boolean") this.model.voice.deaf = data.deaf;
      this.publish();
      return;
    }
    if (evt === "VOICE_STATE_CREATE" || evt === "VOICE_STATE_UPDATE") {
      if (this.model.channel) {
        this.model.channel.voice_states = upsertVoiceState(this.model.channel.voice_states, data || {});
      }
      this.publish();
      return;
    }
    if (evt === "VOICE_STATE_DELETE") {
      if (this.model.channel) {
        this.model.channel.voice_states = removeVoiceState(this.model.channel.voice_states, data || {});
      }
      const id = memberId(data || {});
      if (id) delete this.model.speaking[id];
      this.publish();
      return;
    }
    if (evt === "SPEAKING_START" || evt === "SPEAKING_STOP") {
      this.#recordSpeaking(data?.user_id, evt === "SPEAKING_START");
      this.publish();
    }
  }
}
