"use strict";
const path = require("path");
const { spawn } = require("child_process");

const pluginDir = path.resolve(process.argv[2]);
const WebSocket = require(path.join(pluginDir, "node_modules", "ws"));
const { WebSocketServer } = WebSocket;
const UUID = "com.packrat.stream-deck-ultimate-bundle";
const messages = [];
let child;

function waitFor(pred, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const timer = setInterval(() => {
      const value = messages.find(pred);
      if (value) {
        clearInterval(timer);
        resolve(value);
      } else if (Date.now() - start > timeout) {
        clearInterval(timer);
        reject(new Error("Timed out waiting for Stream Deck message. Seen: " + JSON.stringify(messages)));
      }
    }, 40);
  });
}

(async () => {
  const server = new WebSocketServer({ port: 0, host: "127.0.0.1" });
  await new Promise(resolve => server.once("listening", resolve));
  const port = server.address().port;
  const connection = new Promise(resolve => server.once("connection", resolve));

  child = spawn(process.execPath, [
    path.join(pluginDir, "bin", "plugin.cjs"),
    "-port", String(port),
    "-pluginUUID", UUID,
    "-registerEvent", "registerPlugin"
  ], {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, APPDATA: path.join(pluginDir, ".smoke-state") }
  });

  let stderr = "";
  child.stderr.on("data", d => { stderr += d.toString(); });
  const ws = await Promise.race([
    connection,
    new Promise((_, reject) => setTimeout(() => reject(new Error("Plugin never opened its WebSocket. " + stderr)), 5000))
  ]);

  ws.on("message", raw => {
    try { messages.push(JSON.parse(raw.toString())); } catch {}
  });

  await waitFor(m => m.event === "registerPlugin" && m.uuid === UUID);

  ws.send(JSON.stringify({
    event: "willAppear",
    action: UUID + ".media",
    context: "ctx-media",
    device: "dev-1",
    payload: { settings: { mode: "mute" } }
  }));
  await waitFor(m => m.event === "setTitle" && m.context === "ctx-media" && m.payload?.title === "MUTE");

  ws.send(JSON.stringify({
    event: "willAppear",
    action: UUID + ".window",
    context: "ctx-window",
    device: "dev-1",
    payload: { settings: { mode: "right" } }
  }));
  await waitFor(m => m.event === "setTitle" && m.context === "ctx-window" && m.payload?.title === "RIGHT");

  console.log("runtime smoke passed");
  ws.close();
  server.close();
  child.kill();
})().catch(err => {
  console.error(err.stack || err);
  if (child) child.kill();
  process.exitCode = 1;
});
