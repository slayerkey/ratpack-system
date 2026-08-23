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
  render();
}

function removeVoiceState(raw) {
  var userId = currentUserId(raw);
  if (!userId && raw && raw.user_id) userId = String(raw.user_id);
  if (!userId) return;
  model.members = model.members.filter(function (entry) { return currentUserId(entry) !== userId; });
  if (model.detailUserId === userId) closeMemberDetail();
  render();
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
  render();
}

function nextNonce() {
  rpcNonce += 1;
  return "packrat-discord-" + Date.now() + "-" + rpcNonce;
}

function clearPending(reason) {
  Object.keys(rpcPending).forEach(function (nonce) {
    var pending = rpcPending[nonce];
    clearTimeout(pending.timer);
    pending.reject(new Error(reason || "RPC disconnected"));
    delete rpcPending[nonce];
  });
}

function rpcRequest(cmd, args, evt, timeoutMs) {
  return new Promise(function (resolve, reject) {
    if (!rpcSocket || rpcSocket.readyState !== WebSocket.OPEN) {
      reject(new Error("Discord RPC socket is not open"));
      return;
    }
    var nonce = nextNonce();
    var payload = { cmd: cmd, args: args || {}, nonce: nonce };
    if (evt) payload.evt = evt;
    var timer = setTimeout(function () {
      if (!rpcPending[nonce]) return;
      delete rpcPending[nonce];
      reject(new Error(cmd + " timed out"));
    }, Math.max(1000, Number(timeoutMs) || REQUEST_TIMEOUT_MS));
    rpcPending[nonce] = { resolve: resolve, reject: reject, timer: timer, cmd: cmd };
    try {
      rpcSocket.send(JSON.stringify(payload));
    } catch (error) {
      clearTimeout(timer);
      delete rpcPending[nonce];
      reject(error);
    }
  });
}

function handleRpcMessage(event) {
  var payload;
  try { payload = JSON.parse(event.data); } catch (error) { return; }

  if (payload && payload.nonce && rpcPending[payload.nonce]) {
    var pending = rpcPending[payload.nonce];
    clearTimeout(pending.timer);
    delete rpcPending[payload.nonce];
    if (payload.evt === "ERROR" || (payload.data && payload.data.code && payload.cmd === "DISPATCH")) {
      pending.reject(new Error(payload.data && payload.data.message ? payload.data.message : "Discord RPC error"));
    } else {
      pending.resolve(payload.data);
    }
    return;
  }

  if (!payload || payload.cmd !== "DISPATCH" || !payload.evt) return;
  handleDispatch(payload.evt, payload.data || {});
}

function handleDispatch(evt, data) {
  if (evt === "VOICE_CHANNEL_SELECT") {
    refreshSelectedChannel();
    return;
  }
  if (evt === "VOICE_SETTINGS_UPDATE") {
    if (typeof data.mute === "boolean") model.voice.mute = data.mute;
    if (typeof data.deaf === "boolean") model.voice.deaf = data.deaf;
    renderControls();
    return;
  }
  if (evt === "VOICE_STATE_CREATE" || evt === "VOICE_STATE_UPDATE") {
    upsertVoiceState(data);
    return;
  }
  if (evt === "VOICE_STATE_DELETE") {
    removeVoiceState(data);
    return;
  }
  if (evt === "SPEAKING_START") {
    setSpeaking(data.user_id, true);
    return;
  }
  if (evt === "SPEAKING_STOP") {
    setSpeaking(data.user_id, false);
  }
}

function connectOnePort(port) {
  return new Promise(function (resolve) {
    var settled = false;
    var url = "ws://127.0.0.1:" + port + "/?v=1&client_id=" + encodeURIComponent(DISCORD_CLIENT_ID) + "&encoding=json";
    var socket;
    try { socket = new WebSocket(url); } catch (error) { resolve(null); return; }
    var timer = setTimeout(function () {
      if (settled) return;
      settled = true;
      try { socket.close(); } catch (error) { }
      resolve(null);
    }, 900);
    socket.addEventListener("open", function () {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(socket);
    }, { once: true });
    socket.addEventListener("error", function () {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(null);
    }, { once: true });
    socket.addEventListener("close", function () {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(null);
    }, { once: true });
  });
}

async function findDiscordSocket() {
  for (var port = DISCORD_PORT_FIRST; port <= DISCORD_PORT_LAST; port += 1) {
    var socket = await connectOnePort(port);
    if (socket) return socket;
  }
  return null;
}

function installSocket(socket) {
  rpcSocket = socket;
  socket.addEventListener("message", handleRpcMessage);
  socket.addEventListener("close", function () {
    if (rpcSocket !== socket) return;
    rpcSocket = null;
    clearPending("Discord RPC disconnected");
    currentChannelSubscriptions = null;
    model.channel = null;
    model.members = [];
    if (!fixtureMode) {
      setState("disconnected");
      scheduleReconnect();
    }
  });
}

function scheduleReconnect() {
  if (fixtureMode || reconnectTimer) return;
  reconnectTimer = setTimeout(function () {
    reconnectTimer = null;
    startLiveConnection();
  }, RECONNECT_MS);
}

async function subscribe(evt, args) {
  return rpcRequest("SUBSCRIBE", args || {}, evt);
}

async function unsubscribe(evt, args) {
  try { await rpcRequest("UNSUBSCRIBE", args || {}, evt); } catch (error) { }
}

async function setChannelSubscriptions(channelId) {
  if (currentChannelSubscriptions === channelId) return;
  if (currentChannelSubscriptions) {
    var oldArgs = { channel_id: currentChannelSubscriptions };
    await Promise.all([
      unsubscribe("VOICE_STATE_CREATE", oldArgs),
      unsubscribe("VOICE_STATE_UPDATE", oldArgs),
      unsubscribe("VOICE_STATE_DELETE", oldArgs),
      unsubscribe("SPEAKING_START", oldArgs),
      unsubscribe("SPEAKING_STOP", oldArgs)
    ]);
  }
  currentChannelSubscriptions = channelId || null;
  if (!channelId) return;
  var args = { channel_id: channelId };
  await Promise.all([
    subscribe("VOICE_STATE_CREATE", args),
    subscribe("VOICE_STATE_UPDATE", args),
    subscribe("VOICE_STATE_DELETE", args),
    subscribe("SPEAKING_START", args),
    subscribe("SPEAKING_STOP", args)
  ]);
}

async function refreshSelectedChannel() {
  if (!rpcSocket) return;
  try {
    var channel = await rpcRequest("GET_SELECTED_VOICE_CHANNEL", {});
    await setChannelSubscriptions(channel && channel.id ? String(channel.id) : null);
    setChannel(channel || null);
  } catch (error) {
    setChannel(null);
  }
}

async function bootstrapAuthenticated() {
  try {
    await Promise.all([
      subscribe("VOICE_CHANNEL_SELECT", {}),
      subscribe("VOICE_SETTINGS_UPDATE", {})
    ]);
    var voice = await rpcRequest("GET_VOICE_SETTINGS", {});
    if (voice) {
      model.voice.mute = Boolean(voice.mute);
      model.voice.deaf = Boolean(voice.deaf);
    }
    await refreshSelectedChannel();
  } catch (error) {
    setState("authorization");
  }
}

var sessionAccessToken = "";

async function authenticateWithToken(token) {
  try {
    var data = await rpcRequest("AUTHENTICATE", { access_token: token });
    var scopes = data && Array.isArray(data.scopes) ? data.scopes : [];
    var hasRead = scopes.indexOf("rpc.voice.read") >= 0;
    var hasWrite = scopes.indexOf("rpc.voice.write") >= 0;
    if (!hasRead || !hasWrite) {
      sessionAccessToken = "";
      setState("authorization");
      return false;
    }
    sessionAccessToken = String(token || "");
    model.account = data.user || null;
    await bootstrapAuthenticated();
    return true;
  } catch (error) {
    sessionAccessToken = "";
    setState("authorization");
    return false;
  }
}

function base64Url(bytes) {
  var binary = "";
  for (var index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function createPkce() {
  if (!globalThis.crypto || !crypto.getRandomValues || !crypto.subtle) throw new Error("PKCE crypto unavailable");
  var random = new Uint8Array(32);
  crypto.getRandomValues(random);
  var verifier = base64Url(random);
  var encoded = new TextEncoder().encode(verifier);
  var digest = await crypto.subtle.digest("SHA-256", encoded);
  return { verifier: verifier, challenge: base64Url(new Uint8Array(digest)) };
}

async function exchangeAuthorizationCode(code, verifier) {
  var body = new URLSearchParams();
  body.set("grant_type", "authorization_code");
  body.set("client_id", DISCORD_CLIENT_ID);
  body.set("code", String(code || ""));
  body.set("redirect_uri", DISCORD_REDIRECT_URI);
  body.set("code_verifier", verifier);

  var controller = typeof AbortController === "function" ? new AbortController() : null;
  var timer = controller ? setTimeout(function () { controller.abort(); }, 12000) : null;
  try {
    var response = await fetch(DISCORD_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      cache: "no-store",
      credentials: "omit",
      signal: controller ? controller.signal : undefined
    });
    if (!response.ok) throw new Error("Discord token exchange returned HTTP " + response.status);
    var data = await response.json();
    if (!data || !data.access_token) throw new Error("Discord token exchange returned no access token");
    return data;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function beginAuthorization() {
  if (!rpcSocket || rpcSocket.readyState !== WebSocket.OPEN) return;
  var button = document.getElementById("authorizeButton");
  button.disabled = true;
  model.authorizationCodeReceived = false;
  try {
    var pkce = await createPkce();
    var data = await rpcRequest("AUTHORIZE", {
      client_id: DISCORD_CLIENT_ID,
      response_type: "code",
      redirect_uri: DISCORD_REDIRECT_URI,
      scopes: DISCORD_SCOPES,
      code_challenge: pkce.challenge,
      code_challenge_method: "S256"
    }, null, 120000);
    if (!data || !data.code) throw new Error("Discord authorization returned no code");
    model.authorizationCodeReceived = true;
    var tokenData;
    try {
      tokenData = await exchangeAuthorizationCode(data.code, pkce.verifier);
    } catch (exchangeError) {
      setState("exchange-required");
      return;
    }
    await authenticateWithToken(tokenData.access_token);
  } catch (error) {
    setState("auth-failed");
  } finally {
    button.disabled = false;
  }
}

async function startLiveConnection() {
  if (fixtureMode) return;
  if (!DISCORD_CLIENT_ID || DISCORD_CLIENT_ID === "__DISCORD_CLIENT_ID__") {
    setState("setup");
    return;
  }
  if (rpcSocket && rpcSocket.readyState === WebSocket.OPEN) return;
  setState("disconnected");
  var socket = await findDiscordSocket();
  if (!socket) {
    setState("disconnected");
    scheduleReconnect();
    return;
  }
  installSocket(socket);
  var token = sessionAccessToken;
  try {
    if (!token && typeof globalThis.__PACKRAT_DISCORD_ACCESS_TOKEN === "string") token = globalThis.__PACKRAT_DISCORD_ACCESS_TOKEN.trim();
  } catch (error) { }
  if (token) await authenticateWithToken(token);
  else setState("authorization");
}

async function setSelfVoice(field, nextValue) {
  if (fixtureMode) {
    model.voice[field] = Boolean(nextValue);
    renderControls();
    return;
  }
  if (!rpcSocket || model.state !== "voice") return;
  var args = {};
  args[field] = Boolean(nextValue);
  try {
    var data = await rpcRequest("SET_VOICE_SETTINGS", args);
    if (data && typeof data.mute === "boolean") model.voice.mute = data.mute;
    if (data && typeof data.deaf === "boolean") model.voice.deaf = data.deaf;
    renderControls();
  } catch (error) {
    try {
      var refreshed = await rpcRequest("GET_VOICE_SETTINGS", {});
      if (refreshed) {
        model.voice.mute = Boolean(refreshed.mute);
        model.voice.deaf = Boolean(refreshed.deaf);
      }
    } catch (innerError) { }
    renderControls();
  }
}
