(() => {
  const DEFAULTS = {
    displayMode: "detailed",
    showAvatar: true,
    showDisplayName: true,
    showChannel: true,
    showServer: true,
    ordering: "stable",
    slotIndex: 1,
    speakingAnimation: false,
    accent: "#2BE86A",
    fallbackInitials: true,
    combinedBehavior: "tap-mute-hold-deafen",
    channelPressBehavior: "refresh",
    memberId: "",
  };
  const ID_TO_KIND = {
    "com.packrat.voice-deck.status": "status",
    "com.packrat.voice-deck.mute": "mute",
    "com.packrat.voice-deck.deafen": "deafen",
    "com.packrat.voice-deck.mute-deafen": "combined",
    "com.packrat.voice-deck.channel": "channel",
    "com.packrat.voice-deck.member": "member",
    "com.packrat.voice-deck.member-slot": "member-slot",
    "com.packrat.voice-deck.spotlight": "spotlight",
    "com.packrat.voice-deck.activity": "activity",
    "com.packrat.voice-deck.member-count": "count",
    "com.packrat.voice-deck.connection": "connection",
    "com.packrat.voice-deck.navigator": "navigator",
  };

  let socket = null;
  let uiUuid = "";
  let context = "";
  let actionUuid = "";
  let kind = "status";
  let settings = { ...DEFAULTS };
  let snapshot = null;

  const $ = (id) => document.getElementById(id);

  function send(message) {
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  function save() {
    settings = {
      ...settings,
      memberId: $("memberId").value,
      slotIndex: Math.max(1, Math.min(50, Number($("slotIndex").value || 1))),
      ordering: $("ordering").value,
      displayMode: $("displayMode").value,
      showChannel: $("showChannel").checked,
      showServer: $("showServer").checked,
      showAvatar: $("showAvatar").checked,
      showDisplayName: $("showDisplayName").checked,
      fallbackInitials: $("fallbackInitials").checked,
      speakingAnimation: $("speakingAnimation").checked,
      combinedBehavior: $("combinedBehavior").value,
      channelPressBehavior: $("channelPressBehavior").value,
      accent: $("accent").value.toUpperCase(),
    };
    $("accentValue").textContent = settings.accent;
    send({ event: "setSettings", action: actionUuid, context, payload: settings });
  }

  function applySettings(next) {
    settings = { ...DEFAULTS, ...(next || {}) };
    $("memberId").value = String(settings.memberId || "");
    $("slotIndex").value = Number(settings.slotIndex || 1);
    $("ordering").value = settings.ordering === "speaking-first" ? "speaking-first" : "stable";
    $("displayMode").value = settings.displayMode === "compact" ? "compact" : "detailed";
    $("showChannel").checked = settings.showChannel !== false;
    $("showServer").checked = settings.showServer !== false;
    $("showAvatar").checked = settings.showAvatar !== false;
    $("showDisplayName").checked = settings.showDisplayName !== false;
    $("fallbackInitials").checked = settings.fallbackInitials !== false;
    $("speakingAnimation").checked = settings.speakingAnimation === true;
    $("combinedBehavior").value = settings.combinedBehavior === "tap-deafen-hold-mute" ? "tap-deafen-hold-mute" : "tap-mute-hold-deafen";
    $("channelPressBehavior").value = settings.channelPressBehavior === "cycle-display" ? "cycle-display" : "refresh";
    const accent = /^#[0-9A-Fa-f]{6}$/.test(String(settings.accent || "")) ? String(settings.accent) : DEFAULTS.accent;
    $("accent").value = accent;
    $("accentValue").textContent = accent.toUpperCase();
  }

  function updateMemberOptions() {
    const select = $("memberId");
    const current = String(settings.memberId || select.value || "");
    const members = snapshot?.members || [];
    select.replaceChildren();
    const blank = document.createElement("option");
    blank.value = "";
    blank.textContent = members.length ? "Choose a member" : "Join a voice channel first";
    select.appendChild(blank);
    for (const member of members) {
      const option = document.createElement("option");
      option.value = member.id;
      option.textContent = `${member.self ? "You · " : ""}${member.displayName}${member.speaking ? " · speaking" : ""}`;
      select.appendChild(option);
    }
    select.value = members.some((member) => member.id === current) ? current : "";
  }

  function updateStatus() {
    const connection = snapshot?.connection || {};
    const authStage = String(connection.authStage || "idle");
    const handshake = String(connection.handshake || "idle");
    const authBusy = ["authorizing", "exchanging", "authenticating"].includes(authStage);
    const connectionBusy = ["connecting", "opening_pipe", "waiting_ready", "retrying"].includes(handshake);
    const dot = $("statusDot");
    dot.className = "dot";
    let title = "Discord closed";
    let detail = "Open Discord Desktop and Voice Deck will reconnect automatically.";

    if (connection.authenticated) {
      dot.classList.add("ready");
      title = snapshot?.channel?.name ? snapshot.channel.name : "Discord connected";
      detail = snapshot?.channel ? `${snapshot.members?.length || 0} in voice${snapshot.guild?.name ? ` · ${snapshot.guild.name}` : ""}` : "Join a voice channel and the keys will populate automatically.";
    } else if (connection.ready && authStage === "authorizing") {
      dot.classList.add("warn");
      title = "Waiting for Discord approval";
      detail = "Approve the Voice Deck authorization prompt in Discord Desktop.";
    } else if (connection.ready && ["exchanging", "authenticating"].includes(authStage)) {
      dot.classList.add("warn");
      title = "Finishing Discord connection";
      detail = "Authorization was received. Voice Deck is completing the local connection.";
    } else if (connection.ready && ["authorization_required", "failed"].includes(authStage)) {
      dot.classList.add(authStage === "failed" ? "error" : "warn");
      title = authStage === "failed" ? "Authorization needs attention" : "Discord authorization needed";
      detail = authStage === "failed" ? "Try Connect Discord again after checking the error below." : "Press Connect Discord once and approve the local Discord prompt.";
    } else if (connectionBusy) {
      dot.classList.add("warn");
      title = "Connecting to Discord";
      detail = "Voice Deck is looking for the local Discord Desktop client.";
    }

    $("statusTitle").textContent = title;
    $("statusDetail").textContent = detail;
    const error = String(connection.error || "");
    $("errorText").hidden = !error;
    $("errorText").textContent = error;
    $("authorize").textContent = connection.authenticated ? "Discord connected" : authBusy || connectionBusy ? "Connecting…" : "Connect Discord";
    $("authorize").disabled = Boolean(connection.authenticated || authBusy || connectionBusy);
  }

  function filterFields() {
    for (const node of document.querySelectorAll("[data-kinds]")) {
      const kinds = String(node.getAttribute("data-kinds") || "").split(/\s+/);
      node.hidden = !kinds.includes(kind);
    }
  }

  function command(name) {
    return send({ event: "sendToPlugin", action: actionUuid, context, payload: { type: "voiceDeck.command", command: name } });
  }

  function startAuthorization() {
    $("statusDot").className = "dot warn";
    $("statusTitle").textContent = "Starting Discord connection";
    $("statusDetail").textContent = "Voice Deck is contacting Discord Desktop. Approve the prompt there if one appears.";
    $("errorText").hidden = true;
    $("authorize").textContent = "Connecting…";
    $("authorize").disabled = true;
    if (!command("authorize")) {
      $("statusDot").className = "dot error";
      $("statusTitle").textContent = "Stream Deck connection unavailable";
      $("statusDetail").textContent = "Close and reopen the Property Inspector, then try again.";
      $("authorize").textContent = "Connect Discord";
      $("authorize").disabled = false;
    }
  }

  window.connectElgatoStreamDeckSocket = (port, uuid, registerEvent, info, rawActionInfo) => {
    uiUuid = uuid;
    const actionInfo = JSON.parse(rawActionInfo || "{}");
    context = String(actionInfo.context || uuid);
    actionUuid = String(actionInfo.action || "");
    kind = ID_TO_KIND[actionUuid] || "status";
    applySettings(actionInfo.payload?.settings || {});
    filterFields();

    socket = new WebSocket(`ws://127.0.0.1:${port}`);
    socket.onopen = () => {
      send({ event: registerEvent, uuid: uiUuid });
      send({ event: "getSettings", action: actionUuid, context });
      send({ event: "sendToPlugin", action: actionUuid, context, payload: { type: "voiceDeck.inspect" } });
    };
    socket.onmessage = (event) => {
      let message = null;
      try { message = JSON.parse(event.data); } catch { return; }
      if (message.event === "didReceiveSettings") applySettings(message.payload?.settings || {});
      if (message.event === "sendToPropertyInspector" && message.payload?.type === "voiceDeck.state") {
        snapshot = message.payload.snapshot || null;
        updateMemberOptions();
        applySettings(settings);
        updateStatus();
      }
    };
  };

  for (const id of ["memberId", "slotIndex", "ordering", "displayMode", "showChannel", "showServer", "showAvatar", "showDisplayName", "fallbackInitials", "speakingAnimation", "combinedBehavior", "channelPressBehavior", "accent"]) {
    $(id).addEventListener(id === "accent" ? "input" : "change", save);
  }
  $("authorize").addEventListener("click", startAuthorization);
  $("refresh").addEventListener("click", () => command("refresh"));
  $("reconnect").addEventListener("click", () => command("reconnect"));
})();
