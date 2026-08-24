/* PackRat Discord Panel live transport.
 *
 * The XENEON widget talks only to the PackRat Discord Bridge on loopback.
 * The companion owns the official Discord StreamKit page and sends a small,
 * normalized voice snapshot to this widget. No Discord token or secret enters
 * the XENEON package.
 */

var BRIDGE_URL = "ws://127.0.0.1:17483";
var BRIDGE_RECONNECT_MS = 3000;
var bridgeConfiguredSignature = "";
var bridgeLastSnapshot = null;

function findMember(userId) {
  for (var index = 0; index < model.members.length; index += 1) {
    if (currentUserId(model.members[index]) === String(userId || "")) return model.members[index];
  }
  return null;
}

function setChannel(channel) {
  model.channel = channel || null;
  if (!channel) {
    model.members = [];
    setState("idle");
    return;
  }
  var raw = Array.isArray(channel.voice_states) ? channel.voice_states : [];
  model.members = raw.map(function (entry, index) { return normalizeMember(entry, index); });
  setState("voice");
}

function upsertVoiceState(raw) {
  var userId = currentUserId(raw);
  if (!userId) return;
  var existing = findMember(userId);
  if (existing) {
    var index = model.members.indexOf(existing);
    var normalized = normalizeMember(raw, existing._order);
    normalized.speaking = existing.speaking;
    normalized.speakerHoldUntil = existing.speakerHoldUntil;
    model.members[index] = normalized;
  } else {
    model.members.push(normalizeMember(raw, model.members.length + 100));
  }
}

function removeVoiceState(raw) {
  var userId = currentUserId(raw);
  if (!userId && raw && raw.user_id) userId = String(raw.user_id);
  if (!userId) return;
  model.members = model.members.filter(function (entry) { return currentUserId(entry) !== userId; });
  if (model.detailUserId === userId) closeMemberDetail();
}

function setSpeaking(userId, speaking) {
  var member = findMember(userId);
  if (!member) return;
  var wasSpeaking = Boolean(member.speaking);
  member.speaking = Boolean(speaking);
  if (member.speaking) {
    member.speakerHoldUntil = 0;
    if (!wasSpeaking) {
      model.activity.unshift({ userId: String(userId), name: displayName(member), at: Date.now() });
      model.activity = model.activity.slice(0, 8);
    }
  } else if (wasSpeaking) {
    member.speakerHoldUntil = Date.now() + SPEAKER_HOLD_MS;
    setTimeout(function () { render(); }, SPEAKER_HOLD_MS + 30);
  }
}

function bridgeSettings() {
  return {
    guildId: String(getIcueProperty("discordServerId", "") || "").replace(/\D/g, ""),
    channelId: String(getIcueProperty("discordVoiceChannelId", "") || "").replace(/\D/g, ""),
    channelLabel: String(getIcueProperty("discordChannelLabel", "Discord Voice") || "Discord Voice").trim() || "Discord Voice"
  };
}

function validDiscordId(value) {
  return /^\d{5,24}$/.test(String(value || ""));
}

function sendBridge(value) {
  if (!rpcSocket || rpcSocket.readyState !== WebSocket.OPEN) return false;
  try {
    rpcSocket.send(JSON.stringify(value));
    return true;
  } catch (error) {
    return false;
  }
}

function configureBridge(force) {
  var cfg = bridgeSettings();
  if (!validDiscordId(cfg.guildId) || !validDiscordId(cfg.channelId)) {
    bridgeConfiguredSignature = "";
    model.channel = null;
    model.members = [];
    setState("setup");
    return false;
  }
  var signature = cfg.guildId + ":" + cfg.channelId + ":" + cfg.channelLabel;
  if (!force && signature === bridgeConfiguredSignature) return true;
  if (!sendBridge({
    command: "configure-streamkit",
    guildId: cfg.guildId,
    channelId: cfg.channelId,
    channelLabel: cfg.channelLabel
  })) return false;
  bridgeConfiguredSignature = signature;
  return true;
}

function applyBridgeChannel(channel, speakingMap) {
  if (!channel) {
    setChannel(null);
    return;
  }

  var previousChannelId = model.channel && model.channel.id ? String(model.channel.id) : "";
  var nextChannelId = channel.id ? String(channel.id) : "";
  var states = Array.isArray(channel.voice_states) ? channel.voice_states : [];

  if (!model.channel || previousChannelId !== nextChannelId) {
    var initial = {
      id: channel.id,
      guild_id: channel.guild_id,
      name: channel.name,
      voice_states: states.map(function (entry) {
        var clone = Object.assign({}, entry);
        clone.speaking = false;
        return clone;
      })
    };
    setChannel(initial);
  } else {
    model.channel.id = channel.id;
    model.channel.guild_id = channel.guild_id;
    model.channel.name = channel.name;
    var present = {};
    states.forEach(function (entry) {
      var id = currentUserId(entry);
      if (!id) return;
      present[id] = true;
      upsertVoiceState(entry);
    });
    model.members.slice().forEach(function (entry) {
      var id = currentUserId(entry);
      if (id && !present[id]) removeVoiceState(entry);
    });
  }

  var nextSpeaking = speakingMap || {};
  model.members.forEach(function (entry) {
    var id = currentUserId(entry);
    setSpeaking(id, Boolean(nextSpeaking[id]));
  });
  setState("voice");
}

function applyBridgeSnapshot(snapshot) {
  bridgeLastSnapshot = snapshot || null;
  if (!snapshot) return;

  if (snapshot.account) model.account = snapshot.account;
  if (snapshot.voice) {
    if (typeof snapshot.voice.mute === "boolean") model.voice.mute = snapshot.voice.mute;
    if (typeof snapshot.voice.deaf === "boolean") model.voice.deaf = snapshot.voice.deaf;
  }

  var cfg = bridgeSettings();
  if (!validDiscordId(cfg.guildId) || !validDiscordId(cfg.channelId)) {
    setState("setup");
    return;
  }

  if (!snapshot.bridge || snapshot.bridge.listening !== true) {
    setState("disconnected");
    return;
  }

  if (!snapshot.discord || snapshot.discord.ready !== true) {
    setState("disconnected");
    return;
  }

  var streamkit = snapshot.streamkit || {};
  if (streamkit.stage === "failed" || streamkit.stage === "browser-exited") {
    setState("auth-failed");
    return;
  }

  if (streamkit.stage !== "ready" || !streamkit.pageReady) {
    model.channel = null;
    model.members = [];
    setState("authorization");
    return;
  }

  applyBridgeChannel(snapshot.channel || {
    id: cfg.channelId,
    guild_id: cfg.guildId,
    name: cfg.channelLabel,
    voice_states: []
  }, snapshot.speaking || {});
  renderControls();
}

function installBridgeSocket(socket) {
  rpcSocket = socket;
  socket.addEventListener("message", function (event) {
    var payload;
    try { payload = JSON.parse(String(event.data || "")); } catch (error) { return; }
    if (payload && payload.type === "snapshot") applyBridgeSnapshot(payload);
  });
  socket.addEventListener("close", function () {
    if (rpcSocket !== socket) return;
    rpcSocket = null;
    bridgeConfiguredSignature = "";
    if (!fixtureMode) {
      setState("disconnected");
      scheduleReconnect();
    }
  });
  socket.addEventListener("error", function () {
    if (rpcSocket === socket) setState("disconnected");
  });
  configureBridge(true);
}

function scheduleReconnect() {
  if (fixtureMode || reconnectTimer) return;
  reconnectTimer = setTimeout(function () {
    reconnectTimer = null;
    startLiveConnection();
  }, BRIDGE_RECONNECT_MS);
}

async function startLiveConnection() {
  if (fixtureMode) return;
  var cfg = bridgeSettings();
  if (!validDiscordId(cfg.guildId) || !validDiscordId(cfg.channelId)) {
    setState("setup");
    return;
  }
  if (rpcSocket && rpcSocket.readyState === WebSocket.OPEN) {
    configureBridge(false);
    return;
  }
  setState("disconnected");
  var socket;
  try { socket = new WebSocket(BRIDGE_URL); } catch (error) {
    scheduleReconnect();
    return;
  }
  var settled = false;
  var timer = setTimeout(function () {
    if (settled) return;
    settled = true;
    try { socket.close(); } catch (error) { }
    scheduleReconnect();
  }, 1800);
  socket.addEventListener("open", function () {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    installBridgeSocket(socket);
  }, { once: true });
  socket.addEventListener("error", function () {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    scheduleReconnect();
  }, { once: true });
}

async function beginAuthorization() {
  if (!rpcSocket || rpcSocket.readyState !== WebSocket.OPEN) {
    await startLiveConnection();
    return;
  }
  configureBridge(true);
  sendBridge({ command: "refresh" });
}

async function setSelfVoice(field, nextValue) {
  if (fixtureMode) {
    model.voice[field] = Boolean(nextValue);
    renderControls();
    return;
  }
  if (!rpcSocket || rpcSocket.readyState !== WebSocket.OPEN) return;
  sendBridge({ command: field === "mute" ? "mute" : "deafen", value: Boolean(nextValue) });
  model.voice[field] = Boolean(nextValue);
  renderControls();
}

/* Existing UI functions were written around the old Discord RPC transport.
 * Override only the transport-specific copy/avatar assumptions so the visual
 * product and eight-size layout remain unchanged.
 */
stateCopy = function () {
  if (model.state === "setup") return ["Discord channel setup required", "Add your Discord Server ID and Voice Channel ID in widget settings.", true];
  if (model.state === "disconnected") return ["PackRat Discord Bridge offline", "Start Stream Deck and Discord. The panel will reconnect automatically.", true];
  if (model.state === "authorization") return ["Connecting to Discord voice", "The companion is loading this channel through Discord StreamKit.", true];
  if (model.state === "auth-failed") return ["Discord voice source needs attention", "Press Refresh. If it persists, check the bridge status page.", true];
  return ["No one in this voice channel", "The panel will update automatically when members appear.", false];
};

avatarUrl = function (raw) {
  if (raw && raw.user && raw.user.avatar_url) return String(raw.user.avatar_url);
  if (raw && raw.avatar_url) return String(raw.avatar_url);
  if (!raw || !raw.user || !raw.user.id || !raw.user.avatar) return "";
  return "https://cdn.discordapp.com/avatars/" + encodeURIComponent(raw.user.id) + "/" + encodeURIComponent(raw.user.avatar) + ".png?size=128";
};
