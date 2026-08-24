(() => {
  const build = window.PACKRAT_BUILD || { flavor: "lite", name: "CS2 Competitive Dashboard", footerLabel: "Explore PackRat", footerUrl: "https://marketplace.elgato.com/%40packrat", liveMetrics: [] };
  const FACEIT_DEVELOPER_PORTAL = "https://developers.faceit.com/";
  const FACEIT_KEY_GUIDE = "https://docs.faceit.com/getting-started/authentication/api-keys/";
  const LEETIFY_DEVELOPER_PAGE = "https://leetify.com/app/developer";
  const COMMAND_WATCHDOG_MS = 12_000;
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
  let latestState = {};
  let registered = false;
  let domReady = false;
  let reconnectTimer;
  let commandTimer;
  let pendingCommand = "";
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
    } catch (error) {
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
    $("open-profiles").addEventListener("click", () => {
      beginCommand("profile", "Opening the bundled profile files…");
      sendToPlugin({ type: "open-profiles-folder" });
    });
    $("enable-gsi").addEventListener("click", () => {
      beginCommand("gsi", "Finding Steam and CS2, starting the local listener, and installing the GSI config…");
      sendToPlugin({ type: "enable-gsi", manualCs2Path: $("manual-path").value.trim() });
    });
    $("disable-gsi").addEventListener("click", () => {
      beginCommand("gsi", "Stopping the local listener and removing the PackRat GSI config…");
      sendToPlugin({ type: "disable-gsi" });
    });
    $("reset-session").addEventListener("click", () => {
      beginCommand("session", "Resetting session…");
      sendToPlugin({ type: "reset-session" });
    });
    $("save-steam").addEventListener("click", () => {
      beginCommand("steam", "Saving Steam profile…");
      sendToPlugin({ type: "set-steam-profile", steamProfile: $("steam-profile").value.trim() });
    });
    $("refresh-online").addEventListener("click", () => {
      beginCommand("steam", "Refreshing Leetify and FACEIT stats…");
      sendToPlugin({ type: "refresh-online" });
    });
    $("save-provider-keys").addEventListener("click", saveProviderKeys);
    $("clear-faceit-key").addEventListener("click", () => {
      beginCommand("provider", "Removing FACEIT key…");
      sendToPlugin({ type: "clear-provider-key", provider: "faceit" });
    });
    $("clear-leetify-key").addEventListener("click", () => {
      beginCommand("provider", "Removing Leetify key…");
      sendToPlugin({ type: "clear-provider-key", provider: "leetify" });
    });
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

    setInteractiveState(registered);
    if (!socketPort) setTransport("connecting", "Connecting to Stream Deck…");
    render();
  });

  function connectSocket() {
    if (!socketPort || !registrationUuid || !registrationEvent) return;
    clearTimeout(reconnectTimer);

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
        sendToPlugin({ type: "get-status" });
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
      finishCommand();
      setInteractiveState(false);
      setTransport("bad", "Stream Deck connection error · retrying…");
    };

    socket.onclose = () => {
      registered = false;
      finishCommand();
      setInteractiveState(false);
      setTransport("warn", "Stream Deck disconnected · retrying…");
      clearTimeout(reconnectTimer);
      reconnectTimer = window.setTimeout(connectSocket, 800);
    };
  }

  function saveProviderKeys() {
    const faceitApiKey = $("faceit-api-key").value.trim();
    const leetifyApiKey = $("leetify-api-key").value.trim();
    if (!faceitApiKey && !leetifyApiKey) {
      $("provider-feedback").textContent = "Paste at least one provider key first. Leetify unlocks Competitive stats; FACEIT unlocks FACEIT stats.";
      return;
    }
    beginCommand("provider", "Saving keys and testing configured providers…");
    sendToPlugin({ type: "set-provider-keys", faceitApiKey, leetifyApiKey });
    $("faceit-api-key").value = "";
    $("leetify-api-key").value = "";
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

  function sendToPlugin(payload) {
    if (!actionUuid || !actionContext) {
      setTransport("bad", "This action is missing its Stream Deck context");
      finishCommand();
      return false;
    }
    return send({ event: "sendToPlugin", action: actionUuid, context: actionContext, payload });
  }

  function openUrl(url) {
    if (url) send({ event: "openUrl", payload: { url } });
  }

  function handleMessage(message) {
    if (message.event === "didReceiveSettings") {
      actionSettings = message.payload?.settings || {};
      renderMetric();
      return;
    }
    if (message.event === "sendToPropertyInspector") {
      latestState = message.payload || {};
      const commandResult = latestState.commandResult;
      finishCommand();
      renderState();
      renderMetric();
      renderCommandResult(commandResult);
    }
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
        : `${selectedLabel} will start updating after Live CS2 Tracking connects.`;
      return;
    }
    if (actionUuid.endsWith(".live")) {
      $("metric-hint").textContent = status.gsiConfigured
        ? `${selectedLabel} updates automatically from CS2.`
        : `Enable Live CS2 Tracking below to start ${selectedLabel}.`;
      return;
    }
    if (actionUuid.endsWith(".competitive")) {
      $("metric-hint").textContent = `${selectedLabel} is a Leetify-backed Competitive stat. Save your Steam profile and Leetify API key below.`;
      return;
    }
    if (actionUuid.endsWith(".faceit")) {
      $("metric-hint").textContent = `${selectedLabel} comes from FACEIT. Save your Steam profile and FACEIT API key below.`;
      return;
    }
    $("metric-hint").textContent = "Choose what this key displays.";
  }

  function renderState() {
    if (!$("status-text")) return;
    const status = latestState.status || {};
    const account = latestState.account || {};
    const setup = latestState.setup || {};
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
        $("gsi-feedback").textContent = "Setup succeeded. CS2 was already open, so close and reopen CS2 once. Then enter any game mode and wait for Connected to CS2.";
      } else {
        $("status-text").textContent = "GSI installed · launch CS2";
        $("gsi-feedback").textContent = "Setup succeeded. Launch CS2, enter any game mode, and this will change to Connected to CS2 when the first game-state update arrives.";
      }
    } else if (status.gsiConfigured) {
      dot.classList.add(status.cs2Running ? "warn" : "good");
      $("status-text").textContent = status.cs2Running ? "Waiting for CS2 game state" : "Ready · launch CS2";
      $("gsi-feedback").textContent = status.cs2Running
        ? "Tracking is enabled. Enter Deathmatch, Premier, Competitive, or another game mode. If this never changes to Connected, restart CS2 once."
        : "Tracking is enabled. Launch CS2 and enter a game mode. No API key is required for live tracking.";
    } else {
      dot.classList.add("warn");
      $("status-text").textContent = "Live tracking not enabled";
      $("gsi-feedback").textContent = "Tracking is off. Click Enable once. PackRat will find CS2 and install its local Valve GSI config automatically.";
    }

    $("enable-gsi").textContent = status.gsiConfigured ? "Reinstall Live Tracking" : "Enable Live CS2 Tracking";
    $("port-pill").textContent = status.listenerPort ? `LOCAL :${status.listenerPort}` : "LOCAL ONLY";
    $("setup-error").hidden = !error;
    $("setup-error").textContent = error;
    $("session-value").textContent = `${session.wins || 0}W ${session.losses || 0}L`;
    if (document.activeElement !== $("manual-path")) $("manual-path").value = setup.manualCs2Path || "";

    if (build.flavor === "pro") {
      if (document.activeElement !== $("steam-profile")) $("steam-profile").value = account.steamProfile || "";
      $("steam-feedback").textContent = account.steamConfigured
        ? "Steam profile saved. Leetify and FACEIT use this identity when their own API key is configured."
        : "Save your Steam profile once before loading Leetify or FACEIT stats.";
      renderKeyState("faceit-key-state", account.faceitKeyConfigured, online.faceit);
      renderKeyState("leetify-key-state", account.leetifyKeyConfigured, online.leetify);
      $("faceit-state").textContent = sourceText(online.faceit, account.faceitKeyConfigured ? "Waiting for Steam profile" : "FACEIT key required");
      $("leetify-state").textContent = sourceText(online.leetify, account.leetifyKeyConfigured ? "Waiting for Steam profile" : "Leetify key required");
      $("view-faceit").hidden = !online.faceit?.profileUrl;
      $("view-leetify").hidden = !online.leetify?.profileUrl;
      $("leetify-attribution").hidden = online.leetify?.status !== "ready";
      $("clear-faceit-key").hidden = !account.faceitKeyConfigured;
      $("clear-leetify-key").hidden = !account.leetifyKeyConfigured;
      if (!pendingCommand || pendingCommand !== "provider") {
        if (account.faceitKeyConfigured || account.leetifyKeyConfigured) {
          $("provider-feedback").textContent = "Leetify powers Competitive stats. FACEIT powers FACEIT stats. Saved keys stay local and are not shown again after saving.";
        }
      }
    }

    renderMetricHint();
  }

  function renderCommandResult(result) {
    if (!result) return;
    if (result.command === "open-profiles-folder") {
      $("profile-feedback").textContent = result.ok
        ? "Profile folder opened. Double click the Competitive, Live Match, or Starter file for your Stream Deck model, then click Install."
        : result.message;
      return;
    }
    if (result.command === "disable-gsi" && result.ok) {
      $("gsi-feedback").textContent = "Live tracking disabled. PackRat stopped the local listener and removed its GSI config.";
      return;
    }
    if ((result.command === "set-steam-profile" || result.command === "refresh-online") && result.message) {
      $("steam-feedback").textContent = result.message;
      return;
    }
    if ((result.command === "set-provider-keys" || result.command === "clear-provider-key") && result.message) {
      $("provider-feedback").textContent = result.message;
    }
  }

  function beginCommand(kind, text) {
    finishCommand();
    pendingCommand = kind;
    setInteractiveState(false);
    setFeedback(kind, text);
    commandTimer = window.setTimeout(() => {
      if (!pendingCommand) return;
      const stalled = pendingCommand;
      pendingCommand = "";
      setInteractiveState(registered);
      setFeedback(stalled, "No response after 12 seconds. The command stopped waiting. Check the status above, then retry once. If it repeats, reinstall with Rat Dev and report the status message.");
      sendToPlugin({ type: "get-status" });
    }, COMMAND_WATCHDOG_MS);
  }

  function finishCommand() {
    clearTimeout(commandTimer);
    commandTimer = undefined;
    pendingCommand = "";
    setInteractiveState(registered);
  }

  function setFeedback(kind, text) {
    if (kind === "gsi") $("gsi-feedback").textContent = text;
    if (kind === "steam") $("steam-feedback").textContent = text;
    if (kind === "provider") $("provider-feedback").textContent = text;
    if (kind === "profile") $("profile-feedback").textContent = text;
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
    document.querySelectorAll(".plugin-command").forEach((element) => { element.disabled = !enabled; });
    if ($("metric-select")) $("metric-select").disabled = !enabled;
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

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
  }
})();
