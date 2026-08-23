/* Discord Voice Panel for XENEON Edge.
 *
 * Live transport uses Discord's deprecated local WebSocket RPC on ports 6463 to 6472.
 * The product requests only rpc.voice.read and rpc.voice.write.
 * A Discord client secret must never be embedded in this widget.
 */

var DISCORD_CLIENT_ID = "__DISCORD_CLIENT_ID__";
var DISCORD_SCOPES = ["rpc.voice.read", "rpc.voice.write"];
var DISCORD_PORT_FIRST = 6463;
var DISCORD_PORT_LAST = 6472;
var REQUEST_TIMEOUT_MS = 5000;
var RECONNECT_MS = 5000;
var SPEAKER_HOLD_MS = 900;

var SLOT_SPECS = [
  { id: "s-h", w: 840, h: 344 },
  { id: "s-v", w: 696, h: 416 },
  { id: "m-h", w: 840, h: 696 },
  { id: "m-v", w: 696, h: 840 },
  { id: "l-h", w: 1688, h: 696 },
  { id: "l-v", w: 696, h: 1688 },
  { id: "xl-h", w: 2536, h: 696 },
  { id: "xl-v", w: 696, h: 2536 }
];

var rpcSocket = null;
var rpcPending = {};
var rpcNonce = 0;
var reconnectTimer = null;
var currentChannelSubscriptions = null;
var liveStarted = false;
var fixtureMode = false;
var copy = {};

var model = {
  state: "setup",
  account: null,
  channel: null,
  members: [],
  voice: { mute: false, deaf: false },
  activity: [],
  detailUserId: null,
  authorizationCodeReceived: false
};

function getIcueProperty(name, fallback) {
  try {
    var value = globalThis[name];
    if (typeof Node !== "undefined" && value instanceof Node) return fallback;
    if (value === undefined || value === null) return fallback;
    return value;
  } catch (error) {
    return fallback;
  }
}

function readSettings() {
  return {
    showRecent: getIcueProperty("showRecentActivity", true) !== false,
    text: String(getIcueProperty("textColor", "#F4F6F8") || "#F4F6F8"),
    accent: String(getIcueProperty("accentColor", "#2BE86A") || "#2BE86A"),
    background: String(getIcueProperty("backgroundColor", "#090B10") || "#090B10")
  };
}

function applySettings() {
  var cfg = readSettings();
  document.documentElement.style.setProperty("--text", cfg.text);
  document.documentElement.style.setProperty("--accent", cfg.accent);
  document.documentElement.style.setProperty("--bg", cfg.background);
  document.body.classList.toggle("recent-off", !cfg.showRecent);
  renderActivity();
}

async function t(key) {
  try {
    if (typeof tr === "function") {
      var value = await tr(key);
      if (value !== undefined && value !== null && String(value)) return String(value);
    }
  } catch (error) { }
  return key;
}

async function loadTranslations() {
  var keys = [
    "Discord Voice Panel",
    "VOICE CHANNEL",
    "Connecting to Discord",
    "The panel will update automatically.",
    "Discord setup required",
    "Add the PackRat Discord application Client ID before release.",
    "Discord desktop not connected",
    "Start Discord desktop and the panel will reconnect.",
    "Discord authorization required",
    "Authorize voice read and voice write to continue.",
    "Connect Discord",
    "Authorization approved",
    "Secure token exchange is still required before release.",
    "Not in a voice channel",
    "Join a voice channel in Discord",
    "Panel updates automatically when you join.",
    "member",
    "members",
    "Mute",
    "Unmute",
    "Deafen",
    "Undeafen",
    "Mute microphone",
    "Unmute microphone",
    "Deafen audio",
    "Undeafen audio",
    "RECENT ACTIVITY",
    "Recent activity",
    "No recent speakers yet",
    "Speaking",
    "Muted",
    "Deafened",
    "Listening",
    "Account",
    "Voice channel members",
    "Voice controls",
    "Close details",
    "spoke now",
    "spoke recently",
    "Yes",
    "No",
    "Unknown"
  ];
  var values = await Promise.all(keys.map(function (key) { return t(key); }));
  keys.forEach(function (key, index) { copy[key] = values[index]; });
  setText("eyebrow", getCopy("VOICE CHANNEL"));
  setText("activityTitle", getCopy("RECENT ACTIVITY"));
  setText("activityEmpty", getCopy("No recent speakers yet"));
  setText("authorizeButton", getCopy("Connect Discord"));
  document.getElementById("stage").setAttribute("aria-label", getCopy("Discord Voice Panel"));
  document.getElementById("roster").setAttribute("aria-label", getCopy("Voice channel members"));
  document.getElementById("voiceControls").setAttribute("aria-label", getCopy("Voice controls"));
  document.getElementById("activityPanel").setAttribute("aria-label", getCopy("Recent activity"));
  document.getElementById("accountChip").setAttribute("aria-label", getCopy("Account"));
  document.getElementById("detailClose").setAttribute("aria-label", getCopy("Close details"));
  render();
}

function getCopy(key) {
  return copy[key] || key;
}

function setText(id, value) {
  var element = document.getElementById(id);
  if (element && value !== null && value !== undefined) element.textContent = String(value);
}

function nearestSlot() {
  var width = Math.max(1, window.innerWidth || document.documentElement.clientWidth || 840);
  var height = Math.max(1, window.innerHeight || document.documentElement.clientHeight || 344);
  var best = SLOT_SPECS[0];
  var score = Infinity;
  for (var index = 0; index < SLOT_SPECS.length; index += 1) {
    var spec = SLOT_SPECS[index];
    var candidate = Math.abs(Math.log(width / spec.w)) + Math.abs(Math.log(height / spec.h));
    if (candidate < score) {
      score = candidate;
      best = spec;
    }
  }
  return best.id;
}

function applySlot() {
  document.body.setAttribute("data-slot", nearestSlot());
}

function setState(next) {
  model.state = next;
  document.body.setAttribute("data-state", next);
  render();
}

function currentUserId(entry) {
  return entry && entry.user && entry.user.id ? String(entry.user.id) : "";
}

function displayName(entry) {
  if (!entry) return getCopy("Unknown");
  if (entry.nick) return String(entry.nick);
  if (entry.user && entry.user.global_name) return String(entry.user.global_name);
  if (entry.user && entry.user.username) return String(entry.user.username);
  return getCopy("Unknown");
}

function fullUsername(entry) {
  if (!entry || !entry.user) return "";
  var username = String(entry.user.username || "");
  var discriminator = String(entry.user.discriminator || "");
  if (discriminator && discriminator !== "0") return username + "#" + discriminator;
  return username;
}

function initials(entry) {
  var name = displayName(entry).trim();
  if (!name) return "?";
  var parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function avatarUrl(entry) {
  if (!entry || !entry.user || !entry.user.id || !entry.user.avatar) return "";
  return "https://cdn.discordapp.com/avatars/" + encodeURIComponent(String(entry.user.id)) + "/" + encodeURIComponent(String(entry.user.avatar)) + ".png?size=96";
}

function stateOf(entry) {
  var voice = entry && entry.voice_state ? entry.voice_state : {};
  return {
    mute: Boolean(voice.mute || voice.self_mute),
    deaf: Boolean(voice.deaf || voice.self_deaf),
    suppress: Boolean(voice.suppress)
  };
}

function iconSvg(kind) {
  if (kind === "mic") return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11v1a7 7 0 0 0 14 0v-1M12 19v3M9 22h6" /></svg>';
  if (kind === "headphones") return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 13v-2a8 8 0 0 1 16 0v2M4 13h3v7H5a2 2 0 0 1-2-2v-3a2 2 0 0 1 1-2zM20 13h-3v7h2a2 2 0 0 0 2-2v-3a2 2 0 0 0-1-2z" /></svg>';
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h2l2-3 3 7 3-9 3 5h3" /></svg>';
}

function createAvatar(entry, className) {
  var wrapper = document.createElement("div");
  wrapper.className = className || "avatar-wrap";
  var url = avatarUrl(entry);
  if (url) {
    var image = document.createElement("img");
    image.className = "avatar";
    image.alt = "";
    image.loading = "lazy";
    image.referrerPolicy = "no-referrer";
    image.src = url;
    image.addEventListener("error", function () {
      var fallback = document.createElement("div");
      fallback.className = "avatar-fallback";
      fallback.textContent = initials(entry);
      image.replaceWith(fallback);
    }, { once: true });
    wrapper.appendChild(image);
  } else {
    var fallback = document.createElement("div");
    fallback.className = "avatar-fallback";
    fallback.textContent = initials(entry);
    wrapper.appendChild(fallback);
  }
  return wrapper;
}

function priority(entry) {
  var now = Date.now();
  if (entry.speaking) return 2;
  if (entry.speakerHoldUntil && entry.speakerHoldUntil > now) return 2;
  return 0;
}

function sortedMembers() {
  return model.members.slice().sort(function (left, right) {
    var difference = priority(right) - priority(left);
    if (difference) return difference;
    return (left._order || 0) - (right._order || 0);
  });
}

function statusText(entry) {
  var voice = stateOf(entry);
  if (entry.speaking) return getCopy("Speaking");
  if (voice.deaf) return getCopy("Deafened");
  if (voice.mute) return getCopy("Muted");
  return getCopy("Listening");
}

function renderRoster() {
  var roster = document.getElementById("roster");
  roster.replaceChildren();
  var members = sortedMembers();
  members.forEach(function (entry) {
    var row = document.createElement("button");
    row.type = "button";
    row.className = "member-row interactive" + (entry.speaking ? " speaking" : "");
    row.setAttribute("role", "listitem");
    row.dataset.userId = currentUserId(entry);
    row.appendChild(createAvatar(entry, "avatar-wrap"));

    var memberCopy = document.createElement("div");
    memberCopy.className = "member-copy";
    var name = document.createElement("div");
    name.className = "member-name";
    name.textContent = displayName(entry);
    var meta = document.createElement("div");
    meta.className = "member-meta";
    meta.textContent = statusText(entry);
    memberCopy.append(name, meta);
    row.appendChild(memberCopy);

    var stateIcons = document.createElement("div");
    stateIcons.className = "state-icons";
    var voice = stateOf(entry);
    if (entry.speaking) {
      var speaker = document.createElement("span");
      speaker.className = "state-chip speaker";
      speaker.title = getCopy("Speaking");
      speaker.innerHTML = iconSvg("speaker");
      stateIcons.appendChild(speaker);
    }
    if (voice.mute) {
      var mute = document.createElement("span");
      mute.className = "state-chip active";
      mute.title = getCopy("Muted");
      mute.innerHTML = iconSvg("mic");
      stateIcons.appendChild(mute);
    }
    if (voice.deaf) {
      var deaf = document.createElement("span");
      deaf.className = "state-chip active";
      deaf.title = getCopy("Deafened");
      deaf.innerHTML = iconSvg("headphones");
      stateIcons.appendChild(deaf);
    }
    row.appendChild(stateIcons);
    row.addEventListener("click", function () { openMemberDetail(entry); });
    roster.appendChild(row);
  });
}

function relativeActivity(timestamp) {
  var age = Math.max(0, Date.now() - timestamp);
  if (age < 4500) return getCopy("spoke now");
  return getCopy("spoke recently");
}

function renderActivity() {
  var cfg = readSettings();
  document.body.classList.toggle("recent-off", !cfg.showRecent);
  var panel = document.getElementById("activityPanel");
  var list = document.getElementById("activityList");
  list.replaceChildren();
  var entries = cfg.showRecent ? model.activity.slice(0, 8) : [];
  panel.classList.toggle("is-empty", entries.length === 0);
  setText("activityCount", String(entries.length));
  entries.forEach(function (entry) {
    var item = document.createElement("li");
    item.className = "activity-item";
    var dot = document.createElement("span");
    dot.className = "activity-dot";
    var name = document.createElement("span");
    name.className = "activity-name";
    name.textContent = entry.name;
    var time = document.createElement("span");
    time.className = "activity-time";
    time.textContent = relativeActivity(entry.at);
    item.append(dot, name, time);
    list.appendChild(item);
  });
}

function renderControls() {
  var canControl = model.state === "voice";
  var mute = document.getElementById("muteButton");
  var deafen = document.getElementById("deafenButton");
  mute.disabled = !canControl;
  deafen.disabled = !canControl;
  mute.classList.toggle("is-active", Boolean(model.voice.mute));
  deafen.classList.toggle("is-active", Boolean(model.voice.deaf));
  setText("muteLabel", model.voice.mute ? getCopy("Unmute") : getCopy("Mute"));
  setText("deafenLabel", model.voice.deaf ? getCopy("Undeafen") : getCopy("Deafen"));
  mute.setAttribute("aria-label", model.voice.mute ? getCopy("Unmute microphone") : getCopy("Mute microphone"));
  deafen.setAttribute("aria-label", model.voice.deaf ? getCopy("Undeafen audio") : getCopy("Deafen audio"));
}

function renderHeader() {
  var channel = model.channel;
  var count = channel && model.members ? model.members.length : 0;
  var label = count === 1 ? getCopy("member") : getCopy("members");
  setText("memberCount", count + " " + label);
  setText("accountName", model.account && model.account.username ? String(model.account.username) : "Discord");
  if (model.state === "voice" && channel) setText("channelName", channel.name || getCopy("VOICE CHANNEL"));
  else if (model.state === "idle") setText("channelName", getCopy("Not in a voice channel"));
  else if (model.state === "disconnected") setText("channelName", getCopy("Discord desktop not connected"));
  else if (model.state === "authorization") setText("channelName", getCopy("Discord authorization required"));
  else if (model.state === "exchange-required") setText("channelName", getCopy("Authorization approved"));
  else setText("channelName", getCopy("Discord setup required"));
}

function renderEmpty() {
  var title = getCopy("Connecting to Discord");
  var hint = getCopy("The panel will update automatically.");
  if (model.state === "setup") {
    title = getCopy("Discord setup required");
    hint = getCopy("Add the PackRat Discord application Client ID before release.");
  } else if (model.state === "disconnected") {
    title = getCopy("Discord desktop not connected");
    hint = getCopy("Start Discord desktop and the panel will reconnect.");
  } else if (model.state === "authorization") {
    title = getCopy("Discord authorization required");
    hint = getCopy("Authorize voice read and voice write to continue.");
  } else if (model.state === "exchange-required") {
    title = getCopy("Authorization approved");
    hint = getCopy("Secure token exchange is still required before release.");
  } else if (model.state === "idle") {
    title = getCopy("Not in a voice channel");
    hint = getCopy("Join a voice channel in Discord") + ". " + getCopy("Panel updates automatically when you join.");
  }
  setText("emptyTitle", title);
  setText("emptyHint", hint);
}

function render() {
  document.body.setAttribute("data-state", model.state);
  renderHeader();
  renderRoster();
  renderActivity();
  renderControls();
  renderEmpty();
}

function openMemberDetail(entry) {
  model.detailUserId = currentUserId(entry);
  var sheet = document.getElementById("memberDetail");
  var avatar = document.getElementById("detailAvatar");
  avatar.replaceChildren();
  var avatarContent = createAvatar(entry, "detail-avatar-inner");
  while (avatarContent.firstChild) avatar.appendChild(avatarContent.firstChild);
  setText("detailDisplayName", displayName(entry));
  setText("detailUsername", fullUsername(entry));
  var states = document.getElementById("detailStates");
  states.replaceChildren();
  var voice = stateOf(entry);
  var values = [
    { label: getCopy("Speaking"), active: Boolean(entry.speaking), alert: false },
    { label: getCopy("Muted"), active: voice.mute, alert: voice.mute },
    { label: getCopy("Deafened"), active: voice.deaf, alert: voice.deaf }
  ];
  values.forEach(function (value) {
    var chip = document.createElement("span");
    chip.className = "detail-state" + (value.active ? " active" : "") + (value.alert ? " alert" : "");
    chip.textContent = value.label + ": " + (value.active ? getCopy("Yes") : getCopy("No"));
    states.appendChild(chip);
  });
  sheet.classList.add("open");
  sheet.setAttribute("aria-hidden", "false");
}

function closeMemberDetail() {
  model.detailUserId = null;
  var sheet = document.getElementById("memberDetail");
  sheet.classList.remove("open");
  sheet.setAttribute("aria-hidden", "true");
}

function normalizeMember(raw, order) {
  var prior = findMember(currentUserId(raw));
  return {
    user: raw && raw.user ? raw.user : {},
    nick: raw && raw.nick ? raw.nick : "",
    voice_state: raw && raw.voice_state ? raw.voice_state : {},
    volume: raw && raw.volume,
    mute: raw && raw.mute,
    pan: raw && raw.pan,
    speaking: prior ? Boolean(prior.speaking) : false,
    speakerHoldUntil: prior ? Number(prior.speakerHoldUntil || 0) : 0,
    _order: prior ? prior._order : order
  };
}
