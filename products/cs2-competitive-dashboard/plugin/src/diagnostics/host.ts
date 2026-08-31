import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { currentProductFlavor, type ProductFlavor } from "../host-flavor.js";

const PRODUCT_DIR = "CS2CompetitiveDashboard";
const MAX_LOG_BYTES = 2 * 1024 * 1024;

export interface HostDiagnosticSnapshot {
  product: "CS2 Competitive Dashboard";
  flavor: ProductFlavor;
  version: string;
  runtimeFingerprint?: string;
  pid: number;
  pluginDir: string;
  logPath: string;
  processStartedAt: string;
  streamDeckConnected: boolean;
  settingsChannel: "not_checked" | "responsive" | "timeout" | "error";
  setupStage: string;
  steamCandidates: string[];
  selectedSteamPath?: string;
  cs2InstallPath?: string;
  cfgDir?: string;
  cfgExists?: boolean;
  cfgWritable?: boolean;
  configPath?: string;
  configInstalled: boolean;
  listenerRunning: boolean;
  listenerPort?: number;
  listenerUrl?: string;
  cs2Running: boolean;
  requestCount: number;
  firstPacketAt?: string;
  lastPacketAt?: string;
  lastPacketBytes?: number;
  providerAppId?: number;
  gsiConnected: boolean;
  tokenFingerprint?: string;
  lastError?: string;
  lastEvent?: string;
}

type DiagnosticPatch = Partial<Omit<HostDiagnosticSnapshot, "product" | "flavor" | "version" | "runtimeFingerprint" | "pid" | "pluginDir" | "logPath" | "processStartedAt">>;

function baseDir(): string {
  if (process.env.PACKRAT_CS2_DATA_DIR) return path.resolve(process.env.PACKRAT_CS2_DATA_DIR);
  if (process.platform === "win32" && process.env.APPDATA) {
    return path.join(process.env.APPDATA, "PackRat", PRODUCT_DIR);
  }
  return path.join(os.homedir(), ".packrat", PRODUCT_DIR);
}

function readRuntimeFingerprint(): string | undefined {
  try {
    const file = path.join(process.cwd(), "build-info.json");
    const parsed = JSON.parse(readFileSync(file, "utf8")) as { runtimeFingerprint?: unknown };
    const value = typeof parsed.runtimeFingerprint === "string" ? parsed.runtimeFingerprint.trim().toLowerCase() : "";
    return /^[a-f0-9]{64}$/.test(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

function safeDetail(value: unknown): unknown {
  if (value instanceof Error) return { name: value.name, message: value.message, stack: value.stack };
  if (Array.isArray(value)) return value.map(safeDetail);
  if (value && typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (/api.?key|token|authorization|secret/i.test(key)) {
        output[key] = entry ? "<redacted>" : entry;
      } else {
        output[key] = safeDetail(entry);
      }
    }
    return output;
  }
  return value;
}

export function tokenFingerprint(token: string | undefined): string | undefined {
  if (!token) return undefined;
  return createHash("sha256").update(token).digest("hex").slice(0, 10);
}

export class HostDiagnostics {
  readonly flavor = currentProductFlavor();
  readonly rootDir = baseDir();
  readonly logDir = path.join(this.rootDir, "logs");
  readonly stateDir = path.join(this.rootDir, "state");
  readonly logPath = path.join(this.logDir, `cs2-competitive-dashboard-${this.flavor}.log`);
  readonly statePath = path.join(this.stateDir, `gsi-${this.flavor}.json`);

  private state: HostDiagnosticSnapshot = {
    product: "CS2 Competitive Dashboard",
    flavor: this.flavor,
    version: "0.1.0.0",
    runtimeFingerprint: readRuntimeFingerprint(),
    pid: process.pid,
    pluginDir: process.cwd(),
    logPath: this.logPath,
    processStartedAt: new Date().toISOString(),
    streamDeckConnected: false,
    settingsChannel: "not_checked",
    setupStage: "process-start",
    steamCandidates: [],
    configInstalled: false,
    listenerRunning: false,
    cs2Running: false,
    requestCount: 0,
    gsiConnected: false
  };

  constructor() {
    this.ensureDirs();
    this.rotateIfNeeded();
    this.event("plugin process started", {
      flavor: this.flavor,
      version: this.state.version,
      runtimeFingerprint: this.state.runtimeFingerprint,
      pid: process.pid,
      pluginDir: process.cwd(),
      node: process.version,
      platform: `${process.platform} ${process.arch}`,
      logPath: this.logPath
    });
  }

  snapshot(): HostDiagnosticSnapshot {
    return { ...this.state, steamCandidates: [...this.state.steamCandidates] };
  }

  patch(patch: DiagnosticPatch): void {
    this.state = { ...this.state, ...patch };
  }

  event(message: string, detail?: unknown, patch?: DiagnosticPatch): void {
    if (patch) this.patch(patch);
    this.state.lastEvent = message;
    const line = `${new Date().toISOString()} | ${message}${detail === undefined ? "" : ` | ${JSON.stringify(safeDetail(detail))}`}\n`;
    try {
      this.ensureDirs();
      appendFileSync(this.logPath, line, "utf8");
    } catch {
      // Diagnostics must never be able to crash the plugin.
    }
  }

  error(message: string, error: unknown, patch?: DiagnosticPatch): void {
    const text = error instanceof Error ? error.message : String(error);
    this.patch({ ...(patch ?? {}), lastError: text });
    this.event(message, error);
  }

  markPacket(bytes: number, providerAppId?: number): void {
    const now = new Date().toISOString();
    const first = this.state.firstPacketAt ?? now;
    const count = this.state.requestCount + 1;
    this.patch({
      requestCount: count,
      firstPacketAt: first,
      lastPacketAt: now,
      lastPacketBytes: bytes,
      providerAppId,
      gsiConnected: true
    });
    if (count === 1) {
      this.event("first GSI payload received", { bytes, providerAppId });
    } else if (count % 300 === 0) {
      this.event("GSI payload heartbeat", { requestCount: count, bytes, providerAppId });
    }
  }

  async openLogFolder(): Promise<void> {
    this.ensureDirs();
    if (process.platform !== "win32") throw new Error("Open Log Folder is only supported on Windows");

    await new Promise<void>((resolve, reject) => {
      const child = spawn("explorer.exe", [this.logDir], {
        detached: true,
        stdio: "ignore",
        windowsHide: false
      });
      child.once("error", reject);
      child.once("spawn", () => {
        child.unref();
        resolve();
      });
    });

    this.event("open log folder launched", { logDir: this.logDir });
  }

  summaryText(): string {
    const s = this.snapshot();
    return [
      `PackRat CS2 Competitive Dashboard ${s.flavor.toUpperCase()} diagnostics`,
      `Process: running (PID ${s.pid})`,
      `Runtime fingerprint: ${s.runtimeFingerprint ?? "missing"}`,
      `Stream Deck connected: ${s.streamDeckConnected ? "yes" : "no"}`,
      `Settings channel: ${s.settingsChannel}`,
      `Setup stage: ${s.setupStage}`,
      `CS2 install: ${s.cs2InstallPath ?? "not detected"}`,
      `CFG folder: ${s.cfgDir ?? "unknown"}`,
      `CFG writable: ${s.cfgWritable === undefined ? "unknown" : s.cfgWritable ? "yes" : "no"}`,
      `GSI config: ${s.configInstalled ? s.configPath ?? "installed" : "not installed"}`,
      `Listener: ${s.listenerRunning ? s.listenerUrl ?? `127.0.0.1:${s.listenerPort}` : "not running"}`,
      `CS2 process: ${s.cs2Running ? "running" : "not detected"}`,
      `Last GSI packet: ${s.lastPacketAt ?? "none"}`,
      `GSI connected: ${s.gsiConnected ? "yes" : "no"}`,
      `Last error: ${s.lastError ?? "none"}`,
      `Log: ${s.logPath}`
    ].join("\n");
  }

  private ensureDirs(): void {
    mkdirSync(this.logDir, { recursive: true });
    mkdirSync(this.stateDir, { recursive: true });
  }

  private rotateIfNeeded(): void {
    try {
      if (!existsSync(this.logPath) || statSync(this.logPath).size < MAX_LOG_BYTES) return;
      const previous = `${this.logPath}.1`;
      rmSync(previous, { force: true });
      renameSync(this.logPath, previous);
    } catch {
      // Best effort only.
    }
  }
}

export const hostDiagnostics = new HostDiagnostics();

process.on("uncaughtException", (error) => hostDiagnostics.error("uncaught exception", error));
process.on("unhandledRejection", (error) => hostDiagnostics.error("unhandled rejection", error));
process.on("exit", (code) => hostDiagnostics.event("plugin process exiting", { code }));
