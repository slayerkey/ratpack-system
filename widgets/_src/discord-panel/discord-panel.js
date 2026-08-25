function startFixture(fixture) {
  fixtureMode = true;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  model.account = fixture && fixture.user ? fixture.user : { username: "Discord User" };
  model.voice = {
    mute: Boolean(fixture && fixture.voice && fixture.voice.mute),
    deaf: Boolean(fixture && fixture.voice && fixture.voice.deaf)
  };
  model.activity = Array.isArray(fixture && fixture.activity) ? fixture.activity.slice(0, 8) : [];
  setChannel(fixture && fixture.channel ? fixture.channel : null);
  var speaking = Array.isArray(fixture && fixture.speaking) ? fixture.speaking : [];
  speaking.forEach(function (userId) {
    var member = findMember(userId);
    if (member) member.speaking = true;
  });
  if (fixture && fixture.state && fixture.state !== "voice" && fixture.state !== "idle") setState(String(fixture.state));
  render();
}

function installTestHooks() {
  globalThis.__PACKRAT_DISCORD_TEST__ = {
    getState: function () {
      return {
        state: model.state,
        channel: model.channel ? { id: model.channel.id, name: model.channel.name } : null,
        members: model.members.map(function (entry) {
          return {
            id: currentUserId(entry),
            name: displayName(entry),
            speaking: Boolean(entry.speaking),
            voice: stateOf(entry)
          };
        }),
        voice: { mute: model.voice.mute, deaf: model.voice.deaf },
        activityCount: model.activity.length,
        slot: document.body.getAttribute("data-slot")
      };
    },
    speaking: function (userId, active) { setSpeaking(String(userId), Boolean(active)); },
    voiceState: function (raw) { upsertVoiceState(raw); render(); },
    remove: function (raw) { removeVoiceState(raw); render(); },
    channel: function (channel) { setChannel(channel || null); },
    snapshot: function (snapshot) { applyBridgeSnapshot(snapshot || null); },
    selfVoice: function (voice) {
      if (voice && typeof voice.mute === "boolean") model.voice.mute = voice.mute;
      if (voice && typeof voice.deaf === "boolean") model.voice.deaf = voice.deaf;
      renderControls();
    }
  };
}

function boot() {
  if (liveStarted) return;
  liveStarted = true;
  try {
    if (typeof icueEvents === "undefined") globalThis.icueEvents = function () {};
  } catch (error) {
    globalThis.icueEvents = function () {};
  }
  applySlot();
  applySettings();
  installTestHooks();
  loadTranslations();

  var fixture = null;
  try { fixture = globalThis.__PACKRAT_DISCORD_FIXTURE__ || null; } catch (error) { fixture = null; }
  if (fixture) startFixture(fixture);
  else startLiveConnection();
}

document.getElementById("authorizeButton").addEventListener("click", beginAuthorization);
document.getElementById("muteButton").addEventListener("click", function () { setSelfVoice("mute", !model.voice.mute); });
document.getElementById("deafenButton").addEventListener("click", function () { setSelfVoice("deaf", !model.voice.deaf); });
document.getElementById("detailClose").addEventListener("click", closeMemberDetail);
window.addEventListener("resize", applySlot);
window.addEventListener("click", function (event) {
  var sheet = document.getElementById("memberDetail");
  if (!sheet.classList.contains("open")) return;
  if (sheet.contains(event.target)) return;
  if (event.target.closest && event.target.closest(".member-row")) return;
  closeMemberDetail();
});

setInterval(function () {
  applySettings();
  if (model.activity.length) renderActivity();
  if (!fixtureMode && (!rpcSocket || rpcSocket.readyState !== WebSocket.OPEN)) startLiveConnection();
}, 1000);

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
else boot();
