(() => {
  const build = window.PACKRAT_BUILD || { flavor: "lite", name: "CS2 Competitive Dashboard", footerLabel: "Explore PackRat", footerUrl: "https://marketplace.elgato.com/maker/packrat", liveMetrics: [] };
  const FACEIT_DEVELOPER_PORTAL = "https://developers.faceit.com/";
  const FACEIT_KEY_GUIDE = "https://docs.faceit.com/getting-started/authentication/api-keys/";
  const LEETIFY_DEVELOPER_PAGE = "https://leetify.com/app/developer";
  const STATUS_POLL_MS = 2_000;

  const labels = {
    score: "Live Score",
    round: "Round / Phase",
    kills: "Kills",
    deaths: "Deaths",
    assists: "Assists",
    kd: "K/D",
    adr: "Session ADR",
    hs: "Session Headshot %",
    health: "Health",
    armor: "Armor",
    money: "Money",
    equipment: "Equipment Value",
    weapon: "Current Weapon",
    ammo: "Ammo",
    bomb: "Bomb State",
    map: "Current Map",
    team: "Team",
    record: "Session Record",
    matches: "Session Matches",
    premier: "Premier Rating",
    "current-map-rank": "Current Map Competitive Rank",
    "best-map-rank": "Best Competitive Map Rank",
    "recent-result": "Recent Competitive Result",
    "win-rate": "Win Rate",
    "leetify-rating": "Leetify Rating",
    elo: "FACEIT Elo",
    level: "FACEIT Level",
    region: "FACEIT Region",
    "recent-record": "FACEIT Recent Record",
    "recent-match": "FACEIT Recent Match"
  };

  let socket;
  let registrationUuid = "";
  let registrationEvent = "";
  let socketPort = "";
  let actionUuid = "";
  let actionContext = "";
  let actionSettings = {};
  let globalSettings = {};
  let latestState = {};
  let registered = false;
  let domReady = false;
  let reconnectTimer;
  let statusTimer;
  const queuedMessages = [];

  const $ = (id) => document.getElementById(id);

  window.connectElgatoStreamDeckSocket = (port, uuid, event, info, actionInfoText) => {
    socketPort = String(port);
    registrationUuid = uuid;
    registrationEvent = event;

    try {
      const actionInfo = JSON.parse(actionInfoText);
      actionUuid = actionInfo.action || "";
      actionContext = actionInfo.context || "";
      actionSettings = actionInfo.payload?.settings || {};
    } catch {
      setTransport("bad", "Could not read Stream Deck action info");
      return;
    }

    connectSocket();
    if (domReady) render();
  };

  document.addEventListener("DOMContentLoaded", () => {
    domReady = true;
    $("product-name").textContent = build.name;
    $("flavor-badge").textContent = build.flavor.toUpperCase();
    $("footer-label").textContent = build.footerLabel;

    $("marketplace-link").addEventListener("click", () => openUrl(build.footerUrl));
    $("get-faceit-key").addEventListener("click", () => openUrl(FACEIT_DEVELOPER_PORTAL));
    $("faceit-key-guide").addEventListener("click", () => openUrl(FACEIT_KEY_GUIDE));
    $("get-leetify-key").addEventListener("click", () => openUrl(LEETIFY_DEVELOPER_PAGE));
    $("view-leetify").addEventListener("click", () => openUrl(latestState.online?.leetify?.profileUrl));
    $("view-faceit").addEventListener("click", () => openUrl(latestState.online?.faceit?.profileUrl));
    $("leetify-attribution").addEventListener("click", () => openUrl("https://leetify.com/"));

    $("metric-select").addEventListener("change", () => {
      actionSettings = { ...actionSettings, metric: $("metric-select").value };
      renderMetricHint();
      send({ event: "setSettings", action: actionUuid, context: actionContext, payload: actionSettings });
    });

    $("save-steam").addEventListener("click", () => {
      const steamProfile = $("steam-profile").value.trim();
      updateGlobalSettings({ steamProfile, refreshNonce: Date.now() });
      $("steam-feedback").textContent = steamProfile
        ? "Steam profile saved. Leetify and FACEIT refresh automatically."
        : "Steam profile cleared.";
    });

    $("refresh-online").addEventListener("click", () => {
      updateGlobalSettings({ refreshNonce: Date.now() });
      $("steam-feedback").textContent = "Refresh requested. Provider keys are checked in the background.";
    });

    $("save-provider-keys").addEventListener("click", () => {
      const faceitApiKey = $("faceit-api-key").value.trim();
      const leetifyApiKey = $("leetify-api-key").value.trim();
      if (!faceitApiKey && !leetifyApiKey) {
        $("provider-feedback").textContent = "Paste at least one key first. Leetify powers Competitive stats; FACEIT powers FACEIT stats.";
        return;
      }

      const patch = { refreshNonce: Date.now() };
      if (faceitApiKey) patch.faceitApiKey = faceitApiKey;
      if (leetifyApiKey) patch.leetifyApiKey = leetifyApiKey;
      updateGlobalSettings(patch);
      $("faceit-api-key").value = "";
      $("leetify-api-key").value = "";
      $("provider-feedback").textContent = "Keys saved locally. Provider connection testing is running in the background.";
    });

    $("clear-faceit-key").addEventListener("click", () => {
      removeGlobalSetting("faceitApiKey", { refreshNonce: Date.now() });
      $("provider-feedback").textContent = "FACEIT key removed.";
    });
    $("clear-leetify-key").addEventListener("click", () => {
      removeGlobalSetting("leetifyApiKey", { refreshNonce: Date.now() });
      $("provider-feedback").textContent = "Leetify key removed.";
    });

    $("reset-session").addEventListener("click", () => {
      updateGlobalSettings({ sessionResetNonce: Date.now() });
      $("session-value").textContent = "0W 0L";
    });

    // Developer-only compatibility controls remain hidden in the HTML. They are not
    // part of normal setup anymore, but keeping their elements avoids breaking old dev copies.
    $("open-profiles")?.addEventListener("click", () => {
      $("profile-feedback").textContent = "Bundled profiles install with the normal plugin package. Rat Dev profile imports only need to be done once manually.";
    });
    $("enable-gsi")?.addEventListener("click", () => requestStatus());
    $("disable-gsi")?.addEventListener("click", () => requestStatus());
    $("run-diagnostics")?.addEventListener("click", () => requestStatus());
    $("copy-diagnostics")?.addEventListener("click", copyDiagnostics);

    setInteractiveState(registered);
    if (!socketPort) setTransport("connecting", "Connecting to Stream Deck…");
    render();
  });

  function connectSocket() {
    if (!socketPort || !registrationUuid || !registrationEvent) return;
    clearTimeout(reconnectTimer);
    clearInterval(statusTimer);

    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
      try { socket.close(); } catch { }
    }

    registered = false;
    setInteractiveState(false);
    setTransport("connecting", "Connecting to Stream Deck…");
    socket = new WebSocket(`ws://127.0.0.1:${socketPort}`);

    socket.onopen = () => {
      try {
        socket.send(JSON.stringify({ event: registrationEvent, uuid: registrationUuid }));
      } catch {
        setTransport("bad", "Could not register Property Inspector");
        return;
      }

      window.setTimeout(() => {
        if (socket?.readyState !== WebSocket.OPEN) return;
        registered = true;
        setTransport("good", "Property Inspector connected");
        setInteractiveState(true);
        flushQueue();
        send({ event: "getSettings", action: actionUuid, context: actionContext });
        send({ event: "getGlobalSettings", context: registrationUuid });
        requestStatus();
        statusTimer = window.setInterval(requestStatus, STATUS_POLL_MS);
        render();
      }, 60);
    };

    socket.onmessage = (message) => {
      try {
        handleMessage(JSON.parse(message.data));
      } catch {
        setTransport("bad", "Received an invalid Stream Deck message");
      }
    };

    socket.onerror = () => {
      registered = false;
      setInteractiveState(false);
      setTransport("bad", "Stream Deck connection error · retrying…");
    };

    socket.onclose = () => {
      registered = false;
      clearInterval(statusTimer);
      setInteractiveState(false);
      setTransport("warn", "Stream Deck disconnected · retrying…");
      clearTimeout(reconnectTimer);
      reconnectTimer = window.setTimeout(connectSocket, 800);
    };
  }

  function handleMessage(message) {
    if (message.event === "didReceiveSettings") {
      actionSettings = message.payload?.settings || {};
      renderMetric();
      return;
    }

    if (message.event === "didReceiveGlobalSettings") {
      globalSettings = message.payload?.settings || {};
      renderState();
      return;
    }

    if (message.event === "sendToPropertyInspector") {
      latestState = message.payload || {};
      renderState();
      renderMetric();
    }
  }

  function send(payload) {
    if (socket?.readyState === WebSocket.OPEN && registered) {
      socket.send(JSON.stringify(payload));
      return true;
    }
    if (queuedMessages.length < 20) queuedMessages.push(payload);
    setTransport("warn", "Waiting for Stream Deck connection…");
    return false;
  }

  function flushQueue() {
    while (queuedMessages.length && socket?.readyState === WebSocket.OPEN && registered) {
      socket.send(JSON.stringify(queuedMessages.shift()));
    }
  }

  function requestStatus() {
    if (!actionUuid || !actionContext) return;
    send({
      event: "sendToPlugin",
      action: actionUuid,
      context: actionContext,
      payload: { type: "get-status" }
    });
  }

  function updateGlobalSettings(patch) {
    globalSettings = { ...globalSettings, ...patch };
    send({ event: "setGlobalSettings", context: registrationUuid, payload: globalSettings });
    renderState();
  }

  function removeGlobalSetting(key, patch = {}) {
    globalSettings = { ...globalSettings, ...patch };
    delete globalSettings[key];
    send({ event: "setGlobalSettings", context: registrationUuid, payload: globalSettings });
    renderState();
  }

  function openUrl(url) {
    if (url) send({ event: "openUrl", payload: { url } });
  }

  function render() {
    if (!document.body) return;
    const pro = build.flavor === "pro";
    $("pro-account-panel").hidden = !pro;
    $("provider-setup-panel").hidden = !pro;
    $("session-panel").hidden = !pro;
    $("profile-summary").textContent = pro
      ? "Pro includes separate Competitive and Live Match layouts for supported Stream Deck models."
      : "Lite includes one simple Starter layout for supported Stream Deck models.";
    renderMetric();
    renderState();
  }

  function renderMetric() {
    if (!$("metric-select")) return;
    let options = [];
    if (actionUuid.endsWith(".live")) options = build.liveMetrics || [];
    else if (actionUuid.endsWith(".session")) options = build.sessionMetrics || [];
    else if (actionUuid.endsWith(".competitive")) options = build.competitiveMetrics || [];
    else if (actionUuid.endsWith(".faceit")) options = build.faceitMetrics || [];

    $("metric-panel").hidden = options.length === 0;
    $("metric-select").innerHTML = options.map((metric) => `<option value="${escapeHtml(metric)}">${escapeHtml(labels[metric] || metric)}</option>`).join("");
    const preferred = options.includes(actionSettings.metric) ? actionSettings.metric : options[0];
    if (preferred) $("metric-select").value = preferred;
    renderMetricHint();
  }

  function renderMetricHint() {
    if (!$("metric-hint") || !$("metric-select")) return;
    const selected = $("metric-select").value;
    const selectedLabel = labels[selected] || "this metric";
    const status = latestState.status || {};

    if (actionUuid.endsWith(".session")) {
      $("metric-hint").textContent = status.gsiConnected
        ? `${selectedLabel} updates from your current tracked CS2 session.`
        : `${selectedLabel} starts updating automatically when CS2 connects.`;
      return;
    }
    if (actionUuid.endsWith(".live")) {
      $("metric-hint").textContent = status.gsiConfigured
        ? `${selectedLabel} updates automatically from CS2.`
        : `PackRat is configuring live tracking automatically for ${selectedLabel}.`;
      return;
    }
    if (actionUuid.endsWith(".competitive")) {
      $("metric-hint").textContent = `${selectedLabel} is powered by Leetify. Save your Steam profile and Leetify API key below.`;
      return;
    }
    if (actionUuid.endsWith(".faceit")) {
      $("metric-hint").textContent = `${selectedLabel} comes from FACEIT. Save your Steam profile and FACEIT API key below.`;
      return;
    }
    $("metric-hint").textContent = "Choose what this key displays.";
  }

  function renderState() {
    if (!domReady || !$("status-text")) return;
    const status = latestState.status || {};
    const session = latestState.session || {};
    const online = latestState.online || {};
    const error = latestState.message || status.error || "";

    const dot = $("status-dot");
    dot.className = "status-dot";

    if (status.gsiConnected) {
      dot.classList.add("good");
      $("status-text").textContent = "Connected to CS2";
      $("gsi-feedback").textContent = "Live game state is arriving from CS2. Live and session keys are updating automatically.";
    } else if (status.gsiRestartRequired) {
      dot.classList.add("warn");
      if (status.cs2Running) {
        $("status-text").textContent = "GSI installed · restart CS2 once";
        $("gsi-feedback").textContent = "Automatic setup succeeded while CS2 was already open. Close and reopen CS2 once, then enter a game mode.";
      } else {
        $("status-text").textContent = "GSI installed · launch CS2";
        $("gsi-feedback").textContent = "Automatic setup succeeded. Launch CS2 and enter a game mode.";
      }
    } else if (status.gsiConfigured) {
      dot.classList.add(status.cs2Running ? "warn" : "good");
      $("status-text").textContent = status.cs2Running ? "Waiting for CS2 game state" : "Ready · launch CS2";
      $("gsi-feedback").textContent = status.cs2Running
        ? "The local listener and Valve GSI config are ready. Enter a game mode. If this is the first install, restart CS2 once."
        : "Automatic tracking setup is complete. Launch CS2 and enter a game mode.";
    } else if (error) {
      dot.classList.add("bad");
      $("status-text").textContent = "Automatic setup needs attention";
      $("gsi-feedback").textContent = error;
    } else {
      dot.classList.add("warn");
      const stage = status.setupStage && status.setupStage !== "idle" ? status.setupStage : "starting";
      $("status-text").textContent = "Automatic setup in progress";
      $("gsi-feedback").textContent = `PackRat is preparing local CS2 tracking (${stage}). No setup button is required.`;
    }

    $("session-value").textContent = `${session.wins || 0}W ${session.losses || 0}L · ${session.matches || 0} matches`;
    $("steam-profile").value = globalSettings.steamProfile || "";

    const providerMeta = globalSettings.providerMeta || {};
    setProvider("faceit", online.faceit, providerMeta.faceitConfigured);
    setProvider("leetify", online.leetify, providerMeta.leetifyConfigured);

    const install = latestState.install || {};
    $("gsi-path").textContent = install.file || status.configPath || "Automatic setup pending";
    $("restart-warning").hidden = !status.gsiRestartRequired;
    $("profile-feedback").textContent = build.flavor === "pro"
      ? "Competitive and Live Match profiles are bundled for supported Stream Deck models. Rat Dev profile imports are a one-time development fallback."
      : "The Starter profile is bundled for supported Stream Deck models.";
  }

  function setProvider(name, providerState, configured) {
    const el = $(`${name}-status`);
    if (!el) return;
    el.className = "pill";

    const status = providerState?.status || (configured ? "loading" : "needs-key");
    const text = providerState?.message || friendlyProviderText(name, status);
    if (status === "ready") el.classList.add("good");
    else if (status === "loading" || status === "rate-limited" || status === "private") el.classList.add("warn");
    else if (status === "error" || status === "rejected") el.classList.add("bad");
    el.textContent = text;
  }

  function friendlyProviderText(name, status) {
    if (status === "needs-key") return `${providerLabel(name)} key required`;
    if (status === "loading") return "Checking…";
    if (status === "ready") return "Connected";
    if (status === "private") return "Profile is private";
    if (status === "not-found") return "No matching profile/data";
    if (status === "rejected") return "Key rejected";
    if (status === "rate-limited") return "Rate limited · retrying";
    return "Provider unavailable";
  }

  function providerLabel(name) {
    return name === "faceit" ? "FACEIT" : "Leetify";
  }

  function copyDiagnostics() {
    const summary = latestState.diagnostics?.summary || "Diagnostics are still loading. Keep Stream Deck running and try again.";
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(summary)
        .then(() => { $("diagnostic-feedback").textContent = "Diagnostic summary copied."; })
        .catch(() => { $("diagnostic-feedback").textContent = summary; });
    } else {
      $("diagnostic-feedback").textContent = summary;
    }
  }

  function setInteractiveState(enabled) {
    for (const element of document.querySelectorAll("input, select, button")) {
      if (element.id === "marketplace-link") continue;
      element.disabled = !enabled;
    }
  }

  function setTransport(kind, message) {
    if (!domReady || !$("transport-state")) return;
    $("transport-state").className = `transport ${kind}`;
    $("transport-state").textContent = message;
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
})();
