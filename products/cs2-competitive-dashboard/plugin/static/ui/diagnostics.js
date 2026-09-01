(() => {
  const build = window.PACKRAT_BUILD || { flavor: "pro" };
  const flavor = build.flavor === "lite" ? "lite" : "pro";
  const FIRST_PORT = flavor === "lite" ? 32147 : 32123;
  const LAST_PORT = FIRST_PORT + 23;
  const DIAGNOSTICS_PATH = "/packrat/diagnostics";
  const OPEN_LOG_PATH = "/packrat/open-log-folder";
  const REFRESH_MS = 2_000;
  let currentOrigin = "";
  let currentSummary = "";
  let refreshTimer;

  const $ = (id) => document.getElementById(id);

  document.addEventListener("DOMContentLoaded", () => {
    $("refresh-host-diagnostics")?.addEventListener("click", () => void refresh());
    $("open-host-log")?.addEventListener("click", () => void openLogFolder());
    $("copy-host-diagnostics")?.addEventListener("click", () => void copySummary());
    void refresh();
    refreshTimer = window.setInterval(() => void refresh(), REFRESH_MS);
  });

  window.addEventListener("beforeunload", () => {
    if (refreshTimer) window.clearInterval(refreshTimer);
  });

  async function refresh() {
    const result = await findDiagnosticService();
    if (!result) {
      currentOrigin = "";
      currentSummary = "";
      renderMissing();
      return;
    }
    currentOrigin = result.origin;
    currentSummary = result.data.summary || "";
    renderState(result.data.state || {});
  }

  async function findDiagnosticService() {
    const probes = [];
    for (let port = FIRST_PORT; port <= LAST_PORT; port += 1) probes.push(probe(port));
    const results = await Promise.all(probes);
    return results.find(Boolean) || null;
  }

  async function probe(port) {
    const origin = `http://127.0.0.1:${port}`;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 350);
    try {
      const response = await fetch(`${origin}${DIAGNOSTICS_PATH}`, {
        method: "GET",
        cache: "no-store",
        signal: controller.signal
      });
      if (!response.ok) return null;
      const data = await response.json();
      if (data?.signature !== "packrat-cs2-competitive-dashboard") return null;
      if (data?.state?.flavor !== flavor) return null;
      return { origin, data };
    } catch {
      return null;
    } finally {
      window.clearTimeout(timer);
    }
  }

  function renderState(state) {
    setDiagnosticStatus("good", `${flavor.toUpperCase()} local diagnostics connected · ${state.listenerPort || "listener"}`);
    text("diag-plugin", `Running · PID ${state.pid || "?"}`);
    text("diag-streamdeck", state.streamDeckConnected ? "Connected" : "Not connected");
    text("diag-cs2-install", state.cs2InstallPath || "Not detected");
    text("diag-cfg", state.cfgWritable === true ? "Found · writable" : state.cfgExists === false ? "Not found" : state.cfgDir || "Unknown");
    text("diag-config", state.configInstalled ? "Installed" : "Not installed");
    text("diag-listener", state.listenerRunning ? state.listenerUrl || `127.0.0.1:${state.listenerPort}` : "Not running");
    text("diag-cs2-process", state.cs2Running ? "Running" : "Not detected");
    text("diag-last-packet", state.lastPacketAt ? `${state.lastPacketAt} · ${state.lastPacketBytes || 0} bytes` : "None received");
    text("diag-connected", state.gsiConnected ? "YES · LIVE" : "No");
    text("diag-error", state.lastError || "None");
    text("diag-log", `Persistent log: ${state.logPath || `%APPDATA%\\PackRat\\CS2CompetitiveDashboard\\logs\\cs2-competitive-dashboard-${flavor}.log`}`);
    text("host-diag-feedback", state.gsiConnected
      ? "CS2 is sending GSI data. The dashboard runtime is connected."
      : `Current stage: ${state.setupStage || "unknown"}. This panel refreshes every two seconds.`);
  }

  function renderMissing() {
    setDiagnosticStatus("bad", `${flavor.toUpperCase()} local diagnostic service not found`);
    text("diag-plugin", `No ${flavor.toUpperCase()} listener found on PackRat ports`);
    text("diag-streamdeck", "Unknown");
    text("diag-cs2-install", "Check persistent log");
    text("diag-cfg", "Unknown");
    text("diag-config", "Unknown");
    text("diag-listener", "Not found");
    text("diag-cs2-process", "Unknown");
    text("diag-last-packet", "None");
    text("diag-connected", "No");
    text("diag-error", "Listener may have failed before diagnostics became reachable");
    text("diag-log", `Persistent log: %APPDATA%\\PackRat\\CS2CompetitiveDashboard\\logs\\cs2-competitive-dashboard-${flavor}.log`);
    text("host-diag-feedback", "Open the persistent log path printed by Rat Dev. It records startup even if the localhost listener never starts.");
  }

  async function openLogFolder() {
    if (!currentOrigin) {
      text("host-diag-feedback", "The local listener is not reachable. Open %APPDATA%\\PackRat\\CS2CompetitiveDashboard\\logs manually.");
      return;
    }
    try {
      const response = await fetch(`${currentOrigin}${OPEN_LOG_PATH}`, { method: "POST" });
      if (!response.ok) throw new Error(`Open Log Folder returned HTTP ${response.status}`);
      text("host-diag-feedback", "Opened the PackRat CS2 diagnostic log folder.");
    } catch {
      text("host-diag-feedback", "Could not open the folder automatically. Use the persistent log path shown above.");
    }
  }

  async function copySummary() {
    const summary = currentSummary || [
      `PackRat CS2 Competitive Dashboard ${flavor.toUpperCase()} diagnostics`,
      "Local diagnostics endpoint: not reachable",
      `Persistent log: %APPDATA%\\PackRat\\CS2CompetitiveDashboard\\logs\\cs2-competitive-dashboard-${flavor}.log`
    ].join("\n");
    try {
      await navigator.clipboard.writeText(summary);
      text("host-diag-feedback", "Diagnostic summary copied. Paste it into support or chat.");
    } catch {
      text("host-diag-feedback", "Clipboard access failed. Use the persistent log path shown above.");
    }
  }

  function setDiagnosticStatus(state, value) {
    const dot = $("host-diag-dot");
    if (dot) {
      dot.className = "status-dot";
      dot.classList.add(state === "good" ? "good" : state === "bad" ? "bad" : "warn");
    }
    text("host-diag-status", value);
  }

  function text(id, value) {
    const element = $(id);
    if (element) element.textContent = String(value);
  }
})();
