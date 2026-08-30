/* PackRat Discord Panel live transport.
 *
 * The XENEON widget talks only to the loopback PackRat Voice Bridge.
 * The Stream Deck companion owns Discord IPC and Discord StreamKit RPC.
 * No Discord token or client secret enters the XENEON package.
 */

var BRIDGE_URL = "ws://127.0.0.1:17483";
var BRIDGE_RECONNECT_MS = 3000;
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

function sendBridge(value) {
  if (!rpcSocket || rpcSocket.readyState !== WebSocket.OPEN) return false;
  try {
    rpcSocket.send(JSON.stringify(value));
    return true;
  } catch (error) {
    return false;
  }
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

  if (!snapshot.bridge || snapshot.bridge.listening !== true) {
    setState("disconnected");
    return;
  }

  if (!snapshot.discord || snapshot.discord.ready !== true) {
    setState("disconnected");
    return;
  }

  var streamkit = snapshot.streamkit || {};
  if (streamkit.stage === "failed") {
    setState("auth-failed");
    return;
  }

  if (!snapshot.discord.authenticated) {
    model.channel = null;
    model.members = [];
    setState("authorization");
    return;
  }

  if (!snapshot.channel) {
    setChannel(null);
    renderControls();
    return;
  }

  applyBridgeChannel(snapshot.channel, snapshot.speaking || {});
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
    if (!fixtureMode) {
      setState("disconnected");
      scheduleReconnect();
    }
  });
  socket.addEventListener("error", function () {
    if (rpcSocket === socket) setState("disconnected");
  });
  sendBridge({ command: "refresh" });
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
  if (rpcSocket && rpcSocket.readyState === WebSocket.OPEN) {
    sendBridge({ command: "refresh" });
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
  sendBridge({ command: model.state === "authorization" ? "authorize" : "refresh" });
}

async function setSelfVoice(field, nextValue) {
  if (fixtureMode) {
    model.voice[field] = Boolean(nextValue);
    renderControls();
    return;
  }
  if (!rpcSocket || rpcSocket.readyState !== WebSocket.OPEN) return;
  sendBridge({ command: field === "mute" ? "mute" : "deafen", value: Boolean(nextValue) });
}

stateCopy = function () {
  if (model.state === "setup") return ["Starting Voice Panel", "The PackRat Voice Bridge will connect automatically.", true];
  if (model.state === "disconnected") return ["PackRat Voice Bridge offline", "Start Stream Deck and Discord. The panel will reconnect automatically.", true];
  if (model.state === "authorization") return ["Discord authorization required", "Tap Connect Discord once, then approve the Discord prompt.", true];
  if (model.state === "auth-failed") return ["Discord authorization needs attention", "Tap Connect Discord to retry. The bridge status page has the exact error.", true];
  return ["Not in a voice channel", "Join any Discord voice channel and the panel will follow automatically.", false];
};

avatarUrl = function (raw) {
  if (raw && raw.user && raw.user.avatar_url) return String(raw.user.avatar_url);
  if (raw && raw.avatar_url) return String(raw.avatar_url);
  if (!raw || !raw.user || !raw.user.id || !raw.user.avatar) return "";
  return "https://cdn.discordapp.com/avatars/" + encodeURIComponent(raw.user.id) + "/" + encodeURIComponent(raw.user.avatar) + ".png?size=128";
};
