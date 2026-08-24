(() => {
  const build = window.PACKRAT_BUILD || { flavor: "lite", name: "CS2 Competitive Dashboard", footerLabel: "Explore PackRat", footerUrl: "https://marketplace.elgato.com/%40packrat", liveMetrics: [] };
  const FACEIT_DEVELOPER_PORTAL = "https://developers.faceit.com/";
  const FACEIT_KEY_GUIDE = "https://docs.faceit.com/getting-started/authentication/api-keys/";
  const LEETIFY_DEVELOPER_PAGE = "https://leetify.com/app/developer";
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
  let actionUuid = "";
  let actionContext = "";
  let actionSettings = {};
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
      sendToPlugin({ type: "get-status" });
      render();
    };
    socket.onmessage = (message) => handleMessage(JSON.parse(message.data));
  };

  document.addEventListener("DOMContentLoaded", () => {
    $("product-name").textContent = build.name;
    $("flavor-badge").textContent = build.flavor.toUpperCase();
    $("footer-label").textContent = build.footerLabel;
    $("marketplace-link").addEventListener("click", () => openUrl(build.footerUrl));
    $("enable-gsi").addEventListener("click", () => sendToPlugin({ type: "enable-gsi", manualCs2Path: $("manual-path").value.trim() }));
    $("disable-gsi").addEventListener("click", () => sendToPlugin({ type: "disable-gsi" }));
    $("reset-session").addEventListener("click", () => sendToPlugin({ type: "reset-session" }));
    $("save-steam").addEventListener("click", () => sendToPlugin({ type: "set-steam-profile", steamProfile: $("steam-profile").value.trim() }));
    $("refresh-online").addEventListener("click", () => sendToPlugin({ type: "refresh-online" }));
    $("save-provider-keys").addEventListener("click", saveProviderKeys);
    $("clear-faceit-key").addEventListener("click", () => sendToPlugin({ type: "clear-provider-key", provider: "faceit" }));
    $("clear-leetify-key").addEventListener("click", () => sendToPlugin({ type: "clear-provider-key", provider: "leetify" }));
    $("get-faceit-key").addEventListener("click", () => openUrl(FACEIT_DEVELOPER_PORTAL));
    $("faceit-key-guide").addEventListener("click", () => openUrl(FACEIT_KEY_GUIDE));
    $("get-leetify-key").addEventListener("click", () => openUrl(LEETIFY_DEVELOPER_PAGE));
    $("view-leetify").addEventListener("click", () => openUrl(latestState.online?.leetify?.profileUrl));
    $("view-faceit").addEventListener("click", () => openUrl(latestState.online?.faceit?.profileUrl));
    $("leetify-attribution").addEventListener("click", () => openUrl("https://leetify.com/"));
    $("metric-select").addEventListener("change", () => {
      actionSettings = { ...actionSettings, metric: $("metric-select").value };
      send({ event: "setSettings", action: actionUuid, context: actionContext, payload: actionSettings });
    });
    render();
  });

  function saveProviderKeys() {
    const faceitApiKey = $("faceit-api-key").value.trim();
    const leetifyApiKey = $("leetify-api-key").value.trim();
    if (!faceitApiKey && !leetifyApiKey) return;
    sendToPlugin({ type: "set-provider-keys", faceitApiKey, leetifyApiKey });
    $("faceit-api-key").value = "";
    $("leetify-api-key").value = "";
  }

  function send(payload) {
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload));
  }

  function sendToPlugin(payload) {
    if (!actionUuid || !actionContext) return;
    send({ event: "sendToPlugin", action: actionUuid, context: actionContext, payload });
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
      renderState();
    }
  }

  function render() {
    if (!document.body) return;
    const pro = build.flavor === "pro";
    $("pro-account-panel").hidden = !pro;
    $("provider-setup-panel").hidden = !pro;
    $("session-panel").hidden = !pro;
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
    if (document.activeElement !== $("manual-path")) $("manual-path").value = setup.manualCs2Path || "";

    if (build.flavor === "pro") {
      if (document.activeElement !== $("steam-profile")) $("steam-profile").value = account.steamProfile || "";
      renderKeyState("faceit-key-state", account.faceitKeyConfigured, online.faceit);
      renderKeyState("leetify-key-state", account.leetifyKeyConfigured, online.leetify);
      $("faceit-state").textContent = sourceText(online.faceit, account.faceitKeyConfigured ? "Waiting for Steam profile" : "API key required");
      $("leetify-state").textContent = sourceText(online.leetify, account.leetifyKeyConfigured ? "Waiting for Steam profile" : "API key required");
      $("view-faceit").hidden = !online.faceit?.profileUrl;
      $("view-leetify").hidden = !online.leetify?.profileUrl;
      $("leetify-attribution").hidden = online.leetify?.status !== "ready";
      $("clear-faceit-key").hidden = !account.faceitKeyConfigured;
      $("clear-leetify-key").hidden = !account.leetifyKeyConfigured;
    }
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
