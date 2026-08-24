import http from "node:http";
import { EventEmitter } from "node:events";
import {
  WebSocketFrameDecoder,
  encodeWebSocketFrame,
  isAllowedBridgeOrigin,
  isLoopbackAddress,
  websocketAcceptValue,
} from "./protocol.js";

function corsOrigin(req) {
  const origin = req.headers.origin;
  if (origin === undefined || origin === null || origin === "") return null;
  if (!isAllowedBridgeOrigin(origin)) return false;
  return String(origin);
}

function jsonResponse(req, res, status, value) {
  const body = JSON.stringify(value);
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
  };
  const allowed = corsOrigin(req);
  if (allowed) headers["Access-Control-Allow-Origin"] = allowed;
  res.writeHead(status, headers);
  res.end(body);
}

export class LocalBridgeServer extends EventEmitter {
  constructor({ port, snapshot }) {
    super();
    this.port = port;
    this.snapshot = snapshot;
    this.server = null;
    this.clients = new Set();
  }

  async start() {
    if (this.server) return;
    this.server = http.createServer((req, res) => {
      if (!isLoopbackAddress(req.socket.remoteAddress)) {
        jsonResponse(req, res, 403, { ok: false, error: "loopback only" });
        return;
      }
      const allowedOrigin = corsOrigin(req);
      if (allowedOrigin === false) {
        jsonResponse(req, res, 403, { ok: false, error: "origin not allowed" });
        return;
      }
      if (req.method === "OPTIONS") {
        const headers = {
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "600",
        };
        if (allowedOrigin) headers["Access-Control-Allow-Origin"] = allowedOrigin;
        res.writeHead(204, headers);
        res.end();
        return;
      }
      if (req.url === "/health" || req.url === "/state") {
        jsonResponse(req, res, 200, { ok: true, ...this.snapshot() });
        return;
      }
      jsonResponse(req, res, 404, { ok: false, error: "not found" });
    });

    this.server.on("upgrade", (req, socket) => {
      if (!isLoopbackAddress(socket.remoteAddress)) {
        socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
        return;
      }
      if (!isAllowedBridgeOrigin(req.headers.origin)) {
        socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
        return;
      }
      if (String(req.headers.upgrade || "").toLowerCase() !== "websocket") {
        socket.end("HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n");
        return;
      }
      const key = req.headers["sec-websocket-key"];
      if (!key) {
        socket.end("HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n");
        return;
      }

      const accept = websocketAcceptValue(key);
      socket.write(
        "HTTP/1.1 101 Switching Protocols\r\n" +
          "Upgrade: websocket\r\n" +
          "Connection: Upgrade\r\n" +
          `Sec-WebSocket-Accept: ${accept}\r\n\r\n`,
      );

      const client = { socket, decoder: null };
      client.decoder = new WebSocketFrameDecoder((opcode, payload) => {
        if (opcode === 0x8) {
          try {
            socket.write(encodeWebSocketFrame(Buffer.alloc(0), 0x8));
          } catch {}
          socket.end();
          return;
        }
        if (opcode === 0x9) {
          try {
            socket.write(encodeWebSocketFrame(payload, 0xA));
          } catch {}
          return;
        }
        if (opcode !== 0x1) return;
        let message;
        try {
          message = JSON.parse(payload.toString("utf8"));
        } catch {
          this.#sendClient(client, { type: "error", error: "invalid json" });
          return;
        }
        this.emit("command", message, {
          origin: req.headers.origin || "",
          remoteAddress: socket.remoteAddress || "",
        });
      });

      this.clients.add(client);
      socket.on("data", (chunk) => {
        try {
          client.decoder.push(chunk);
        } catch {
          socket.destroy();
        }
      });
      socket.on("close", () => this.clients.delete(client));
      socket.on("error", () => this.clients.delete(client));
      this.#sendClient(client, { type: "snapshot", ...this.snapshot() });
    });

    await new Promise((resolve, reject) => {
      const onError = (error) => {
        this.server?.off("listening", onListening);
        reject(error);
      };
      const onListening = () => {
        this.server?.off("error", onError);
        resolve();
      };
      this.server.once("error", onError);
      this.server.once("listening", onListening);
      this.server.listen(this.port, "127.0.0.1");
    });
  }

  broadcast(value) {
    for (const client of this.clients) this.#sendClient(client, value);
  }

  broadcastSnapshot() {
    this.broadcast({ type: "snapshot", ...this.snapshot() });
  }

  async stop() {
    for (const client of this.clients) {
      try {
        client.socket.end();
      } catch {}
    }
    this.clients.clear();
    if (!this.server) return;
    const server = this.server;
    this.server = null;
    await new Promise((resolve) => server.close(() => resolve()));
  }

  #sendClient(client, value) {
    if (!client?.socket || client.socket.destroyed) return;
    try {
      client.socket.write(encodeWebSocketFrame(JSON.stringify(value), 0x1));
    } catch {}
  }
}
