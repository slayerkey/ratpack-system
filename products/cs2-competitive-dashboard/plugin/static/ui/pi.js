(() => {
  const build = window.PACKRAT_BUILD || { flavor: "lite", name: "CS2 Competitive Dashboard", footerLabel: "Explore PackRat", footerUrl: "https://marketplace.elgato.com/%40packrat", liveMetrics: [] };
  const labels = {
    score: "Live Score",
    round: "Round / Phase",
    kills: "Kills",
    deaths: "Deaths",
    assists: "Assists",
    kd: "K/D",
    adr: "Session ADR (derived)",
    hs: "Session HS% (derived)",
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
    matches: "Session Matches"
  };

  let socket;
  let registrationUuid = "";
  let actionUuid = "";
  let actionContext = "";
  let actionSettings = {};
  let globalSettings = {};
  let latestState = {};

  const $ = (id) => document.getElementById(id);

  window.connectElgatoStreamDeckSocket = (port, uuid, event, info, actionInfoText) => {
    registrationUuid = uuid;
    const actionInfo = JSON.parse(actionInfoText);
    actionUuid = actionInfo.action;
    actionContext = actionInfo.context;
    actionSettings = actionInfo.payload?.settings || {};

    socket = new WebSocket(`ws://127.0.0.1:${port}`);
    socket.onopen = () => {
      send({ event, uuid });
      send({ event: "getSettings", action: actionUuid, context: actionContext });
      send({ event: "getGlobalSettings", context: registrationUuid });
      sendToPlugin({ type: "get-status" });
      render();
    };
    socket.onmessage = (message) => handleMessage(JSON.parse(message.data));
  };

  document.addEventListener("DOMContentLoaded", () => {
    $("product-name").textContent = build.name;
    $("flavor-badge").textContent = build.flavor.toUpperCase();
    $("footer-label").textContent = build.footerLabel;
    $("marketplace-link").addEventListener("click", () => send({ event: "openUrl", payload: { url: build.footerUrl } }));
    $("enable-gsi").addEventListener("click", () => sendToPlugin({ type: "enable-gsi", manualCs2Path: $("manual-path").value.trim() }));
    $("disable-gsi").addEventListener("click", () => sendToPlugin({ type: "disable-gsi" }));
    $("reset-session").addEventListener("click", () => sendToPlugin({ type: "reset-session" }));
    $("save-steam").addEventListener("click", () => sendToPlugin({ type: "set-steam-profile", steamProfile: $("steam-profile").value.trim() }));
    $("metric-select").addEventListener("change", () => {
      actionSettings = { ...actionSettings, metric: $("metric-select").value };
      send({ event: "setSettings", action: actionUuid, context: actionContext, payload: actionSettings });
    });
    render();
  });

  function send(payload) {
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload));
  }

  function sendToPlugin(payload) {
    if (!actionUuid || !actionContext) return;
    send({ event: "sendToPlugin", action: actionUuid, context: actionContext, payload });
  }

  function handleMessage(message) {
    if (message.event === "didReceiveSettings") {
      actionSettings = message.payload?.settings || {};
      renderMetric();
      return;
    }
    if (message.event === "didReceiveGlobalSettings") {
      globalSettings = message.payload?.settings || {};
      if (!$("manual-path").value) $("manual-path").value = globalSettings.manualCs2Path || "";
      return;
    }
    if (message.event === "sendToPropertyInspector") {
      latestState = message.payload || {};
      renderState();
    }
  }

  function render() {
    if (!document.body) return;
    const pro = build.flavor === "pro";
    $("pro-account-panel").hidden = !pro;
    $("session-panel").hidden = !pro;
    renderMetric();
    renderState();
  }

  function renderMetric() {
    if (!$("metric-select")) return;
    let options = [];
    if (actionUuid.endsWith(".live")) options = build.liveMetrics || [];
    else if (actionUuid.endsWith(".session")) options = build.sessionMetrics || [];

    $("metric-panel").hidden = options.length === 0;
    $("metric-select").innerHTML = options.map((metric) => `<option value="${escapeHtml(metric)}">${escapeHtml(labels[metric] || metric)}</option>`).join("");
    const preferred = options.includes(actionSettings.metric) ? actionSettings.metric : options[0];
    if (preferred) $("metric-select").value = preferred;
  }

  function renderState() {
    if (!$("status-text")) return;
    const status = latestState.status || {};
    const account = latestState.account || {};
    const session = latestState.session || {};
    const error = latestState.message || status.error || "";

    const dot = $("status-dot");
    dot.className = "status-dot";
    if (status.gsiConnected) {
      dot.classList.add("good");
      $("status-text").textContent = "Connected to CS2";
    } else if (status.gsiConfigured) {
      dot.classList.add(status.cs2Running ? "warn" : "good");
      $("status-text").textContent = status.cs2Running ? "Waiting for CS2 game state" : "Ready — launch CS2";
    } else {
      dot.classList.add("warn");
      $("status-text").textContent = "Live tracking not enabled";
    }

    $("port-pill").textContent = status.listenerPort ? `LOCAL :${status.listenerPort}` : "LOCAL ONLY";
    $("setup-error").hidden = !error;
    $("setup-error").textContent = error;
    $("session-value").textContent = `${session.wins || 0}W ${session.losses || 0}L`;

    if (build.flavor === "pro") {
      if (document.activeElement !== $("steam-profile")) $("steam-profile").value = account.steamProfile || "";
      $("faceit-state").textContent = account.steamConfigured ? "Ready for auto detect" : "Add Steam profile";
      $("leetify-state").textContent = account.steamConfigured ? "Leetify required" : "Add Steam profile";
    }
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
  }
})();
