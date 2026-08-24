import http, { type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { RawGsiPayload } from "../core/types.js";
import { isCs2Payload } from "./normalize.js";

const HOST = "127.0.0.1";
const DEFAULT_PORT = 32123;
const MAX_PORT_ATTEMPTS = 24;
const MAX_BODY_BYTES = 512 * 1024;

export interface GsiServerOptions {
  token: string;
  preferredPort?: number;
  onPayload: (payload: RawGsiPayload) => void | Promise<void>;
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

    const firstPort = options.preferredPort ?? DEFAULT_PORT;
    for (let offset = 0; offset < MAX_PORT_ATTEMPTS; offset += 1) {
      const port = firstPort + offset;
      const server = http.createServer((req, res) => {
        void this.handleRequest(req, res, options);
      });

      try {
        await this.listen(server, port);
        this.server = server;
        this.activePort = port;
        return port;
      } catch (error) {
        server.close();
        const code = (error as NodeJS.ErrnoException).code;
        if (code !== "EADDRINUSE" && code !== "EACCES") throw error;
      }
    }

    throw new Error(`Unable to bind a local CS2 GSI listener starting at port ${firstPort}`);
  }

  async stop(): Promise<void> {
    const server = this.server;
    this.server = undefined;
    this.activePort = undefined;
    if (!server?.listening) return;

    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
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
    if (req.method !== "POST" || req.url !== "/gsi") {
      this.respond(res, 404, "Not Found");
      return;
    }

    try {
      const body = await this.readBody(req);
      const payload = JSON.parse(body) as RawGsiPayload;

      if (payload.auth?.token !== options.token) {
        this.respond(res, 401, "Unauthorized");
        return;
      }

      if (!isCs2Payload(payload)) {
        this.respond(res, 400, "Invalid app id");
        return;
      }

      await options.onPayload(payload);
      res.statusCode = 204;
      res.end();
    } catch (error) {
      const status = error instanceof PayloadTooLargeError ? 413 : 400;
      this.respond(res, status, status === 413 ? "Payload Too Large" : "Bad Request");
    }
  }

  private readBody(req: IncomingMessage): Promise<string> {
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
      req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      req.on("error", reject);
    });
  }

  private respond(res: ServerResponse, statusCode: number, message: string): void {
    if (res.headersSent || res.writableEnded) return;
    res.statusCode = statusCode;
    res.setHeader("content-type", "text/plain; charset=utf-8");
    res.end(message);
  }
}

class PayloadTooLargeError extends Error {}
