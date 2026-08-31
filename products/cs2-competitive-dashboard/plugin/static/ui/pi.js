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
      $("gsi-feedback").textContent = `PackRat is configuring live tracking in the background. Current stage: ${stage}.`;
    }

    $("port-pill").textContent = status.listenerPort ? `LOCAL :${status.listenerPort}` : "LOCAL ONLY";
    $("setup-error").hidden = !error;
    $("setup-error").textContent = error;
    $("session-value").textContent = `${session.wins || 0}W ${session.losses || 0}L`;

    if (build.flavor === "pro") {
      if (document.activeElement !== $("steam-profile")) {
        $("steam-profile").value = typeof globalSettings.steamProfile === "string" ? globalSettings.steamProfile : "";
      }

      const faceitConfigured = Boolean(globalSettings.faceitApiKey);
      const leetifyConfigured = Boolean(globalSettings.leetifyApiKey);
      renderKeyState("faceit-key-state", faceitConfigured, online.faceit);
      renderKeyState("leetify-key-state", leetifyConfigured, online.leetify);
      $("faceit-state").textContent = sourceText(online.faceit, faceitConfigured ? "Waiting for Steam profile" : "FACEIT key required");
      $("leetify-state").textContent = sourceText(online.leetify, leetifyConfigured ? "Waiting for Steam profile" : "Leetify key required");
      $("view-faceit").hidden = !online.faceit?.profileUrl;
      $("view-leetify").hidden = !online.leetify?.profileUrl;
      $("leetify-attribution").hidden = online.leetify?.status !== "ready";
      $("clear-faceit-key").hidden = !faceitConfigured;
      $("clear-leetify-key").hidden = !leetifyConfigured;

      if (typeof globalSettings.steamProfile === "string" && globalSettings.steamProfile.trim()) {
        if (!$("steam-feedback").textContent.includes("Refresh requested")) {
          $("steam-feedback").textContent = "Steam profile saved. Provider stats refresh automatically when keys are configured.";
        }
      } else {
        $("steam-feedback").textContent = "Save your Steam profile once before loading Leetify or FACEIT stats.";
      }
    }

    renderMetricHint();
  }

  function renderKeyState(id, configured, source) {
    const element = $(id);
    element.className = "provider-state";
    if (!configured) {
      element.textContent = "API key required";
      element.classList.add("warn");
      return;
    }
    if (source?.status === "ready") {
      element.textContent = "Key saved · Connected";
      element.classList.add("ready");
      return;
    }
    if (source?.status === "unavailable" && /key/i.test(source.message || "")) {
      element.textContent = "Key rejected · replace it";
      element.classList.add("warn");
      return;
    }
    element.textContent = "Key saved";
    element.classList.add("ready");
  }

  function sourceText(source, fallback) {
    if (!source) return fallback;
    const states = {
      ready: "Connected",
      loading: "Loading…",
      not_found: "Profile not found",
      private: "Profile private",
      rate_limited: "Your key is rate limited",
      commercial_gate: "Provider unavailable",
      offline: "API offline",
      unavailable: source.message || "Unavailable",
      not_configured: fallback
    };
    return states[source.status] || fallback;
  }

  async function copyDiagnostics() {
    const report = $("diagnostic-output")?.value || "";
    if (!report) return;
    try {
      await navigator.clipboard.writeText(report);
    } catch {
      // Diagnostics are developer-only now; no setup path depends on clipboard access.
    }
  }

  function setTransport(state, text) {
    if (!domReady || !$("transport-dot")) return;
    const dot = $("transport-dot");
    dot.className = "status-dot";
    if (state === "good") dot.classList.add("good");
    else if (state === "warn" || state === "connecting") dot.classList.add("warn");
    else if (state === "bad") dot.classList.add("bad");
    $("transport-text").textContent = text;
    $("transport-strip").classList.toggle("transport-bad", state === "bad");
  }

  function setInteractiveState(enabled) {
    if (!domReady) return;
    document.querySelectorAll("button, select, input").forEach((element) => {
      if (element.closest("[hidden]")) return;
      element.disabled = !enabled;
    });
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
  }
})();
