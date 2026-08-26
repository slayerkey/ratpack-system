import http, { type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { hostDiagnostics } from "../diagnostics/host.js";
import { defaultGsiPortForFlavor } from "../host-flavor.js";
import type { RawGsiPayload } from "../core/types.js";
import { isCs2Payload } from "./normalize.js";

const HOST = "127.0.0.1";
export const DEFAULT_GSI_PORT = defaultGsiPortForFlavor();
const MAX_PORT_ATTEMPTS = 24;
const MAX_BODY_BYTES = 512 * 1024;
const SHUTDOWN_GRACE_MS = 750;
const DIAGNOSTICS_PATH = "/packrat/diagnostics";
const OPEN_LOG_PATH = "/packrat/open-log-folder";
const PACKET_TRACE_EVERY = 300;

export interface GsiServerOptions {
  token: string;
  preferredPort?: number;
  onPayload: (payload: RawGsiPayload) => void | Promise<void>;
}

function candidatePorts(preferredPort?: number): number[] {
  const first = DEFAULT_GSI_PORT;
  const last = first + MAX_PORT_ATTEMPTS - 1;
  const preferred = Number.isInteger(preferredPort) && preferredPort! >= first && preferredPort! <= last
    ? preferredPort
    : undefined;
  const ports: number[] = [];
  if (preferred !== undefined) ports.push(preferred);
  for (let port = first; port <= last; port += 1) {
    if (port !== preferred) ports.push(port);
  }
  return ports;
}

export class GsiServer {
  private server?: Server;
  private activePort?: number;

  get port(): number | undefined {
    return this.activePort;
  }

  get listening(): boolean {
    return Boolean(this.server?.listening);
  }

  async start(options: GsiServerOptions): Promise<number> {
    if (this.server?.listening && this.activePort) return this.activePort;

    const ports = candidatePorts(options.preferredPort);
    hostDiagnostics.event("listener bind started", {
      flavor: hostDiagnostics.flavor,
      host: HOST,
      preferredPort: options.preferredPort,
      allowedRange: `${ports[0] === options.preferredPort ? DEFAULT_GSI_PORT : ports[0]}-${DEFAULT_GSI_PORT + MAX_PORT_ATTEMPTS - 1}`
    }, { setupStage: "listener-bind" });

    for (const port of ports) {
      const server = http.createServer((req, res) => {
        void this.handleRequest(req, res, options);
      });

      try {
        await this.listen(server, port);
        this.server = server;
        this.activePort = port;
        const url = `http://${HOST}:${port}/`;
        hostDiagnostics.event("listener bind succeeded", { flavor: hostDiagnostics.flavor, host: HOST, port, url }, {
          listenerRunning: true,
          listenerPort: port,
          listenerUrl: url,
          setupStage: "listener-ready"
        });
        return port;
      } catch (error) {
        server.close();
        const code = (error as NodeJS.ErrnoException).code;
        hostDiagnostics.event("listener bind attempt failed", { port, code, error });
        if (code !== "EADDRINUSE" && code !== "EACCES") {
          hostDiagnostics.error("listener bind failed", error);
          throw error;
        }
      }
    }

    const lastPort = DEFAULT_GSI_PORT + MAX_PORT_ATTEMPTS - 1;
    const error = new Error(`Unable to bind a local CS2 GSI listener in the ${hostDiagnostics.flavor} port range ${DEFAULT_GSI_PORT}-${lastPort}`);
    hostDiagnostics.error("listener bind failed", error, { listenerRunning: false });
    throw error;
  }

  async stop(): Promise<void> {
    const server = this.server;
    this.server = undefined;
    this.activePort = undefined;
    hostDiagnostics.patch({ listenerRunning: false, listenerPort: undefined, listenerUrl: undefined });
    if (!server?.listening) return;

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(forceTimer);
        error ? reject(error) : resolve();
      };

      const forceTimer = setTimeout(() => {
        try {
          server.closeIdleConnections?.();
          server.closeAllConnections?.();
        } catch {
          // Best effort only. The close callback remains the source of truth.
        }
      }, SHUTDOWN_GRACE_MS);

      server.close((error) => finish(error ?? undefined));
    });
  }

  private listen(server: Server, port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const onError = (error: Error) => {
        cleanup();
        reject(error);
      };
      const onListening = () => {
        cleanup();
        resolve();
      };
      const cleanup = () => {
        server.off("error", onError);
        server.off("listening", onListening);
      };

      server.once("error", onError);
      server.once("listening", onListening);
      server.listen(port, HOST);
    });
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse, options: GsiServerOptions): Promise<void> {
    const requestPath = req.url ?? "/";

    if (requestPath === DIAGNOSTICS_PATH) {
      this.cors(res);
      if (req.method === "OPTIONS") {
        res.statusCode = 204;
        res.end();
        return;
      }
      if (req.method !== "GET") {
        this.respond(res, 405, "Method Not Allowed");
        return;
      }
      res.statusCode = 200;
      res.setHeader("content-type", "application/json; charset=utf-8");
      res.end(JSON.stringify({
        signature: "packrat-cs2-competitive-dashboard",
        state: hostDiagnostics.snapshot(),
        summary: hostDiagnostics.summaryText()
      }));
      return;
    }

    if (requestPath === OPEN_LOG_PATH) {
      this.cors(res);
      if (req.method === "OPTIONS") {
        res.statusCode = 204;
        res.end();
        return;
      }
      if (req.method !== "POST") {
        this.respond(res, 405, "Method Not Allowed");
        return;
      }
      hostDiagnostics.openLogFolder();
      res.statusCode = 204;
      res.end();
      return;
    }

    const isGsiPath = requestPath === "/" || requestPath === "/gsi";
    if (!isGsiPath) {
      this.respond(res, 404, "Not Found");
      return;
    }
    if (req.method !== "POST") {
      this.respond(res, 405, "Method Not Allowed");
      return;
    }

    const nextPacket = hostDiagnostics.snapshot().requestCount + 1;
    const traceSuccess = nextPacket === 1 || nextPacket % PACKET_TRACE_EVERY === 0;
    if (traceSuccess) hostDiagnostics.event("incoming HTTP request received", { method: req.method, url: requestPath, packet: nextPacket });

    try {
      const body = await this.readBody(req);
      if (traceSuccess) hostDiagnostics.event("GSI request body received", { bytes: body.bytes, url: requestPath, packet: nextPacket });

      let payload: RawGsiPayload;
      try {
        payload = JSON.parse(body.text) as RawGsiPayload;
        if (traceSuccess) hostDiagnostics.event("GSI JSON parse succeeded", { bytes: body.bytes, packet: nextPacket });
      } catch (error) {
        hostDiagnostics.error("GSI JSON parse failed", error);
        this.respond(res, 400, "Bad Request");
        return;
      }

      const providerAppId = Number(payload.provider?.appid);
      if (payload.auth?.token !== options.token) {
        hostDiagnostics.event("GSI auth token rejected", { tokenPresent: Boolean(payload.auth?.token), providerAppId });
        this.respond(res, 401, "Unauthorized");
        return;
      }
      if (traceSuccess) hostDiagnostics.event("GSI auth token accepted", { providerAppId, packet: nextPacket });

      if (!isCs2Payload(payload)) {
        hostDiagnostics.event("GSI provider app id rejected", { providerAppId });
        this.respond(res, 400, "Invalid app id");
        return;
      }
      if (traceSuccess) hostDiagnostics.event("GSI provider app id accepted", { providerAppId, packet: nextPacket });

      await options.onPayload(payload);
      hostDiagnostics.markPacket(body.bytes, providerAppId);
      res.statusCode = 200;
      res.end();
    } catch (error) {
      const status = error instanceof PayloadTooLargeError ? 413 : 400;
      hostDiagnostics.error("GSI request failed", error);
      this.respond(res, status, status === 413 ? "Payload Too Large" : "Bad Request");
    }
  }

  private readBody(req: IncomingMessage): Promise<{ text: string; bytes: number }> {
    return new Promise((resolve, reject) => {
      let size = 0;
      const chunks: Buffer[] = [];

      req.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAX_BODY_BYTES) {
          reject(new PayloadTooLargeError());
          req.destroy();
          return;
        }
        chunks.push(chunk);
      });
      req.on("end", () => resolve({ text: Buffer.concat(chunks).toString("utf8"), bytes: size }));
      req.on("error", reject);
    });
  }

  private cors(res: ServerResponse): void {
    res.setHeader("access-control-allow-origin", "*");
    res.setHeader("access-control-allow-methods", "GET, POST, OPTIONS");
    res.setHeader("access-control-allow-headers", "content-type");
  }

  private respond(res: ServerResponse, statusCode: number, message: string): void {
    if (res.headersSent || res.writableEnded) return;
    res.statusCode = statusCode;
    res.setHeader("content-type", "text/plain; charset=utf-8");
    res.end(message);
  }
}

class PayloadTooLargeError extends Error {}
