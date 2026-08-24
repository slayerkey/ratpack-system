let websocket = null;
let uuid = null;
let actionUuid = "";
let settings = {};

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
  };
  websocket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.event === "didReceiveSettings") {
      settings = message.payload?.settings ?? {};
      render();
    }
  };
}

function save() {
  if (websocket?.readyState !== WebSocket.OPEN) return;
  websocket.send(JSON.stringify({
    event: "setSettings",
    context: uuid,
    payload: settings
  }));
}

function openUrl(url) {
  if (websocket?.readyState !== WebSocket.OPEN) return;
  websocket.send(JSON.stringify({ event: "openUrl", payload: { url } }));
}

function render() {
  document.getElementById("promptCard")?.classList.toggle("hidden", actionUuid !== QUEUE_ACTION);
  document.getElementById("controlCard")?.classList.toggle("hidden", actionUuid !== CONTROL_ACTION);

  const label = document.getElementById("label");
  if (label && document.activeElement !== label) label.value = settings.label ?? "";
  const prompt = document.getElementById("prompt");
  if (prompt && document.activeElement !== prompt) prompt.value = settings.prompt ?? "";
  const operation = document.getElementById("operation");
  if (operation) operation.value = settings.operation ?? "remove-next";
}

function build() {
  document.getElementById("openSetup")?.addEventListener("click", () => openUrl(SETUP_URL));
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
