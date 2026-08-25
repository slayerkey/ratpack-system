let websocket = null;
let uuid = null;
let actionUuid = "";
let settings = {};
let sessionRows = [];
let activeSessionId = null;

const QUEUE_ACTION = "com.packrat.claude-auto-queue.queue-prompt";
const CONTROL_ACTION = "com.packrat.claude-auto-queue.queue-control";
const SETUP_URL = "http://127.0.0.1:19741/";

function connectElgatoStreamDeckSocket(inPort, inUUID, inRegisterEvent, inInfo, inActionInfo) {
  uuid = inUUID;
  try {
    const info = JSON.parse(inActionInfo);
    actionUuid = info.action ?? "";
    settings = info.payload?.settings ?? {};
  } catch {
    actionUuid = "";
    settings = {};
  }

  websocket = new WebSocket(`ws://127.0.0.1:${inPort}`);
  websocket.onopen = () => {
    websocket.send(JSON.stringify({ event: inRegisterEvent, uuid: inUUID }));
    build();
    render();
    requestSessions();
  };
  websocket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.event === "didReceiveSettings") {
      settings = message.payload?.settings ?? {};
      render();
    }
    if (message.event === "sendToPropertyInspector" && message.payload?.type === "sessions") {
      sessionRows = Array.isArray(message.payload.sessions) ? message.payload.sessions : [];
      activeSessionId = message.payload.activeSessionId ?? null;
      render();
    }
  };
}

function save() {
  if (websocket?.readyState !== WebSocket.OPEN) return;
  websocket.send(JSON.stringify({
    event: "setSettings",
    action: actionUuid,
    context: uuid,
    payload: settings
  }));
}

function requestSessions() {
  if (websocket?.readyState !== WebSocket.OPEN) return;
  websocket.send(JSON.stringify({
    event: "sendToPlugin",
    action: actionUuid,
    context: uuid,
    payload: { type: "get-sessions" }
  }));
}

function openUrl(url) {
  if (websocket?.readyState !== WebSocket.OPEN) return;
  websocket.send(JSON.stringify({ event: "openUrl", payload: { url } }));
}

function addOption(select, value, label) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = label;
  select.appendChild(option);
}

function shortSessionLabel(session, { includeState = true } = {}) {
  const parts = [];
  if (session.id === activeSessionId) parts.push("ACTIVE");
  else if (includeState && session.state === "working") parts.push("WORKING");
  else if (includeState && session.state === "need_you") parts.push("NEEDS YOU");

  if (session.lastUserPromptPreview) parts.push(`“${session.lastUserPromptPreview}”`);
  else if (session.label) parts.push(session.label);

  if (session.projectLabel && session.projectLabel !== session.label) {
    parts.push(session.projectLabel);
  }
  const shortId = session.shortId || String(session.id ?? "").slice(0, 8);
  if (shortId) parts.push(`#${shortId}`);
  return parts.join(" · ") || "Claude session";
}

function renderSessionSelect() {
  const select = document.getElementById("session");
  if (!select) return;
  const selected = settings.sessionId ?? "";
  select.textContent = "";

  const active = sessionRows.find((session) => session.id === activeSessionId);
  const engaged = sessionRows.filter((session) => session.state === "working" || session.state === "need_you");
  let autoLabel = "Auto: wait for active Claude session";
  if (active) autoLabel = `Auto: ${shortSessionLabel(active, { includeState: false })}`;
  else if (engaged.length === 1) autoLabel = `Auto: only active · ${shortSessionLabel(engaged[0], { includeState: false })}`;
  addOption(select, "", autoLabel);

  for (const session of sessionRows) {
    addOption(select, session.id, shortSessionLabel(session));
  }

  if (selected && !sessionRows.some((session) => session.id === selected)) {
    addOption(select, selected, "Selected session unavailable");
  }
  select.value = selected;

  const help = document.getElementById("sessionHelp");
  if (help) {
    if (selected) {
      const match = sessionRows.find((session) => session.id === selected);
      help.textContent = match
        ? `Bound to ${shortSessionLabel(match, { includeState: false })}. Queue: ${match.queueCount ?? 0}.`
        : "This key is bound to a Claude session that is not currently visible. Choose Auto or another session to rebind it.";
    } else if (active) {
      help.textContent = `Auto follows ${shortSessionLabel(active, { includeState: false })}. A new real Claude prompt automatically changes the active session.`;
    } else if (engaged.length === 1) {
      help.textContent = `Auto can safely use the only active session: ${shortSessionLabel(engaged[0], { includeState: false })}.`;
    } else if (sessionRows.length > 1) {
      help.textContent = "Multiple Claude sessions are idle or active at once. Start the intended Claude chat or choose one explicitly; PackRat will not guess.";
    } else {
      help.textContent = "Auto follows the session most recently identified by Claude hooks. If sessions are ambiguous, queueing fails safely instead of guessing.";
    }
  }
}

function render() {
  document.getElementById("promptCard")?.classList.toggle("hidden", actionUuid !== QUEUE_ACTION);
  document.getElementById("controlCard")?.classList.toggle("hidden", actionUuid !== CONTROL_ACTION);

  renderSessionSelect();

  const label = document.getElementById("label");
  if (label && document.activeElement !== label) label.value = settings.label ?? "";
  const prompt = document.getElementById("prompt");
  if (prompt && document.activeElement !== prompt) prompt.value = settings.prompt ?? "";
  const operation = document.getElementById("operation");
  if (operation) operation.value = settings.operation ?? "remove-next";
}

function build() {
  document.getElementById("openSetup")?.addEventListener("click", () => openUrl(SETUP_URL));
  document.getElementById("session")?.addEventListener("change", (event) => {
    settings = { ...settings, sessionId: event.target.value || undefined };
    save();
    render();
  });
  document.getElementById("label")?.addEventListener("change", (event) => {
    settings = { ...settings, label: event.target.value.trim() || undefined };
    save();
  });
  document.getElementById("prompt")?.addEventListener("change", (event) => {
    settings = { ...settings, prompt: event.target.value.trim() || undefined };
    save();
  });
  document.getElementById("operation")?.addEventListener("change", (event) => {
    settings = { ...settings, operation: event.target.value };
    save();
  });
}
