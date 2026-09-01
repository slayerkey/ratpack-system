import { execFile } from "node:child_process";
import { access, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import streamDeck from "@elgato/streamdeck";
import type { LiveState, RuntimeStatus, SessionMetrics, SetupStage } from "./core/types.js";
import { StateStore } from "./core/store.js";
import { createGsiToken, GSI_FILENAME, installGsiConfig, removeGsiConfig } from "./gsi/installer.js";
import { normalizeGsiPayload } from "./gsi/normalize.js";
import { GsiServer } from "./gsi/server.js";
import { locateCs2Install } from "./gsi/steam-locator.js";
import { ONLINE_PROFILE_REFRESH_MS } from "./providers/config.js";
import { ProviderClient } from "./providers/direct-client.js";
import { emptyOnlineSnapshot, type OnlineProfileSnapshot } from "./providers/types.js";
import { SessionTracker } from "./session/session-tracker.js";

const execFileAsync = promisify(execFile);
const PI_COMMAND_TIMEOUT_MS = 10_000;
const LOCATE_CS2_TIMEOUT_MS = 7_000;
const LISTENER_START_TIMEOUT_MS = 2_500;
const CONFIG_WRITE_TIMEOUT_MS = 3_000;
const SETTINGS_SAVE_TIMEOUT_MS = 3_000;
const DIAGNOSTIC_STEP_TIMEOUT_MS = 4_000;
const PROFILES_DIR = fileURLToPath(new URL("../profiles/", import.meta.url));

export interface DashboardSnapshot {
  live?: LiveState;
  session: SessionMetrics;
  status: RuntimeStatus;
  online: OnlineProfileSnapshot;
}

type GlobalSettings = {
  gsiEnabled?: boolean;
  gsiPort?: number;
  gsiToken?: string;
  gsiConfigPath?: string;
  cs2InstallPath?: string;
  manualCs2Path?: string;
  steamProfile?: string;
  faceitApiKey?: string;
  leetifyApiKey?: string;
};

type PiCommand =
  | { type: "get-status" }
  | { type: "enable-gsi"; manualCs2Path?: string }
  | { type: "disable-gsi" }
  | { type: "run-diagnostics"; manualCs2Path?: string }
  | { type: "open-profiles-folder" }
  | { type: "reset-session" }
  | { type: "set-steam-profile"; steamProfile?: string }
  | { type: "set-provider-keys"; faceitApiKey?: string; leetifyApiKey?: string }
  | { type: "clear-provider-key"; provider: "faceit" | "leetify" }
  | { type: "refresh-online" };

type PiProgress = (payload: Record<string, unknown>) => void | Promise<void>;

export interface DashboardRuntimeOptions {
  onlineEnabled?: boolean;
}

export class DashboardRuntime {
  private readonly server = new GsiServer();
  private readonly sessionTracker = new SessionTracker();
  private readonly onlineEnabled: boolean;
  private readonly providerClient = new ProviderClient();
  private readonly store = new StateStore<DashboardSnapshot>({
    session: this.sessionTracker.snapshot(),
    status: {
      cs2Running: false,
      gsiConfigured: false,
      gsiConnected: false,
      setupStage: "idle"
    },
    online: emptyOnlineSnapshot()
  });
  private globals: GlobalSettings = {};
  private disconnectTimer?: NodeJS.Timeout;
  private onlineTimer?: NodeJS.Timeout;
  private onlineAbort?: AbortController;
  private onlineRefresh?: Promise<void>;
  private setupStage: SetupStage = "idle";
  private detectedCs2Path?: string;
  private setupTrace: string[] = [];
  private lastDiagnosticReport = "";

  constructor(options: DashboardRuntimeOptions = {}) {
    this.onlineEnabled = options.onlineEnabled ?? false;
  }

  subscribe(listener: (snapshot: DashboardSnapshot) => void): () => void {
    return this.store.subscribe(listener);
  }

  snapshot(): DashboardSnapshot {
    return this.store.get();
  }

  async initialize(): Promise<void> {
    this.globals = (await streamDeck.settings.getGlobalSettings()) as GlobalSettings;
    this.detectedCs2Path = this.globals.cs2InstallPath;
    this.setupStage = this.globals.gsiConfigPath ? "ready" : "idle";
    this.updateStatus({ cs2Running: await this.detectCs2Running() });

    if (this.globals.gsiEnabled && this.globals.gsiToken) {
      try {
        const port = await this.server.start({
          token: this.globals.gsiToken,
          preferredPort: this.globals.gsiPort,
          onPayload: (payload) => this.ingest(payload)
        });

        if (port !== this.globals.gsiPort && this.globals.cs2InstallPath) {
          const installed = await installGsiConfig({
            port,
            token: this.globals.gsiToken,
            manualCs2Path: this.globals.cs2InstallPath
          });
          this.globals.gsiPort = port;
          this.globals.gsiConfigPath = installed.configPath;
          await this.saveGlobals();
        }

        this.setupStage = this.globals.gsiConfigPath ? "ready" : "idle";
        this.updateStatus({
          gsiConfigured: Boolean(this.globals.gsiConfigPath),
          gsiRestartRequired: false,
          setupStage: this.setupStage,
          detectedCs2Path: this.globals.cs2InstallPath,
          listenerPort: port,
          configPath: this.globals.gsiConfigPath,
          error: undefined
        });
      } catch (error) {
        this.setupStage = "idle";
        this.updateStatus({ setupStage: "idle", error: this.errorMessage(error) });
      }
    }

    this.disconnectTimer = setInterval(() => this.checkConnectionFreshness(), 2_000);
    if (this.onlineEnabled) {
      if (this.globals.steamProfile) void this.refreshOnline(true);
      this.onlineTimer = setInterval(() => void this.refreshOnline(false), ONLINE_PROFILE_REFRESH_MS);
    }
  }

  async shutdown(): Promise<void> {
    if (this.disconnectTimer) clearInterval(this.disconnectTimer);
    if (this.onlineTimer) clearInterval(this.onlineTimer);
    this.onlineAbort?.abort();
    await this.server.stop();
  }

  setCs2Running(running: boolean): void {
    this.updateStatus({
      cs2Running: running,
      ...(running ? {} : { gsiConnected: false })
    });
  }

  async handlePiCommand(payload: unknown, onProgress?: PiProgress): Promise<Record<string, unknown>> {
    const command = this.parseCommand(payload);
    if (!command) return { ...this.publicState(), type: "error", message: "Unknown command" };

    this.emitProgress(onProgress, command.type, "received", `Plugin received ${command.type}.`);

    try {
      switch (command.type) {
        case "get-status":
          return this.publicState();
        case "enable-gsi":
          await this.enableGsi(command.manualCs2Path, onProgress);
          return this.commandState(
            "enable-gsi",
            this.store.get().status.gsiRestartRequired
              ? "GSI installed. Restart CS2 once, then enter a game mode."
              : "Live tracking is enabled. Enter a game mode and wait for Connected to CS2."
          );
        case "disable-gsi":
          this.emitProgress(onProgress, command.type, "stopping-listener", "Stopping the local GSI listener…");
          await this.withTimeout(
            this.disableGsi(),
            PI_COMMAND_TIMEOUT_MS,
            "Disabling live tracking took too long. Restart the plugin and try again."
          );
          return this.commandState("disable-gsi", "Live tracking is disabled.");
        case "run-diagnostics": {
          const report = await this.runDiagnostics(command.manualCs2Path, onProgress);
          return {
            ...this.commandState("run-diagnostics", "Diagnostics finished. Copy the report below and send it to PackRat support."),
            diagnostics: { report }
          };
        }
        case "open-profiles-folder":
          this.openProfilesFolder();
          return this.commandState("open-profiles-folder", "Opened the bundled profile files.");
        case "reset-session":
          this.sessionTracker.reset();
          this.publish({ session: this.sessionTracker.snapshot() });
          return this.commandState("reset-session", "Session stats reset.");
        case "set-steam-profile":
          this.globals.steamProfile = command.steamProfile?.trim() || undefined;
          await this.withTimeout(this.saveGlobals(), PI_COMMAND_TIMEOUT_MS, "Saving the Steam profile took too long.");
          this.publish({ online: emptyOnlineSnapshot(this.globals.steamProfile) });
          if (this.onlineEnabled && this.globals.steamProfile) void this.refreshOnline(true);
          return this.commandState("set-steam-profile", this.globals.steamProfile ? "Steam profile saved." : "Steam profile cleared.");
        case "set-provider-keys": {
          const faceit = command.faceitApiKey?.trim();
          const leetify = command.leetifyApiKey?.trim();
          if (faceit) this.globals.faceitApiKey = faceit;
          if (leetify) this.globals.leetifyApiKey = leetify;
          await this.withTimeout(this.saveGlobals(), PI_COMMAND_TIMEOUT_MS, "Saving provider keys took too long.");
          if (this.onlineEnabled && this.globals.steamProfile) void this.refreshOnline(true);
          return this.commandState("set-provider-keys", "Provider keys saved. Testing configured providers now.");
        }
        case "clear-provider-key":
          if (command.provider === "faceit") this.globals.faceitApiKey = undefined;
          else this.globals.leetifyApiKey = undefined;
          await this.withTimeout(this.saveGlobals(), PI_COMMAND_TIMEOUT_MS, "Removing the provider key took too long.");
          if (this.onlineEnabled && this.globals.steamProfile) void this.refreshOnline(true);
          return this.commandState("clear-provider-key", `${command.provider === "faceit" ? "FACEIT" : "Leetify"} key removed.`);
        case "refresh-online":
          if (this.onlineEnabled) {
            await this.withTimeout(this.refreshOnline(true), PI_COMMAND_TIMEOUT_MS, "Provider refresh took too long. Check your keys and internet connection.");
          }
          return this.commandState("refresh-online", "Provider refresh finished.");
      }
    } catch (error) {
      const message = this.errorMessage(error);
      this.trace(`ERROR ${command.type}: ${message}`);
      this.updateStatus({ error: message });
      return {
        ...this.publicState(),
        type: "error",
        message,
        commandResult: { command: command.type, ok: false, message }
      };
    }
  }

  private async enableGsi(manualCs2Path?: string, onProgress?: PiProgress): Promise<void> {
    const manualPath = manualCs2Path?.trim() || this.globals.manualCs2Path;
    const token = this.globals.gsiToken ?? createGsiToken();
    let listenerStarted = false;
    let newConfigPath: string | undefined;
    this.setupTrace = [];

    try {
      this.setSetupStage("finding-cs2", onProgress, "enable-gsi", manualPath
        ? "Checking the CS2 path you provided…"
        : "Finding Steam and the CS2 App 730 installation…");
      const cs2 = await this.withTimeout(
        locateCs2Install(manualPath),
        LOCATE_CS2_TIMEOUT_MS,
        "CS2 detection timed out. Use Advanced Diagnostics below to see exactly which check is failing."
      );
      this.detectedCs2Path = cs2.installDir;
      this.trace(`CS2 resolved: ${cs2.installDir}`);
      this.emitProgress(onProgress, "enable-gsi", "finding-cs2", `Found CS2 at ${cs2.installDir}`, {
        detectedCs2Path: cs2.installDir,
        cfgDir: cs2.cfgDir
      });

      this.setSetupStage("starting-listener", onProgress, "enable-gsi", "Starting the local listener on 127.0.0.1…");
      const port = await this.withTimeout(
        this.server.start({
          token,
          preferredPort: this.globals.gsiPort,
          onPayload: (incoming) => this.ingest(incoming)
        }),
        LISTENER_START_TIMEOUT_MS,
        "The local CS2 listener could not start in time. Run Advanced Diagnostics to test localhost ports."
      );
      listenerStarted = true;
      this.trace(`Listener started: 127.0.0.1:${port}`);
      this.emitProgress(onProgress, "enable-gsi", "starting-listener", `Local listener ready on 127.0.0.1:${port}.`, { listenerPort: port });

      this.setSetupStage("writing-config", onProgress, "enable-gsi", "Writing PackRat's Valve GSI config into CS2…");
      const installed = await this.withTimeout(
        installGsiConfig({ port, token, cs2 }),
        CONFIG_WRITE_TIMEOUT_MS,
        `PackRat found CS2 at ${cs2.installDir}, but writing the GSI config timed out. Run Advanced Diagnostics to test that folder.`
      );
      newConfigPath = installed.configPath;
      this.trace(`Config written: ${installed.configPath}`);
      this.emitProgress(onProgress, "enable-gsi", "writing-config", "GSI config written successfully.", { configPath: installed.configPath });

      this.globals = {
        ...this.globals,
        gsiEnabled: true,
        gsiPort: port,
        gsiToken: token,
        gsiConfigPath: installed.configPath,
        cs2InstallPath: installed.cs2.installDir,
        manualCs2Path: manualPath
      };

      this.setSetupStage("saving-settings", onProgress, "enable-gsi", "Saving the tracking setup in Stream Deck…");
      await this.withTimeout(
        this.saveGlobals(),
        SETTINGS_SAVE_TIMEOUT_MS,
        "The GSI config was written, but Stream Deck did not save the plugin settings in time."
      );
      this.trace("Stream Deck global settings saved.");

      this.setSetupStage("checking-cs2", onProgress, "enable-gsi", "Checking whether cs2.exe is already running…");
      const cs2Running = this.store.get().status.cs2Running || await this.detectCs2Running();
      const alreadyConnected = this.store.get().status.gsiConnected;

      this.setupStage = "ready";
      this.updateStatus({
        cs2Running,
        gsiConfigured: true,
        gsiRestartRequired: false,
        setupStage: "ready",
        detectedCs2Path: installed.cs2.installDir,
        listenerPort: port,
        configPath: installed.configPath,
        error: undefined
      });
      this.trace(`Setup ready. CS2 running: ${cs2Running ? "yes" : "no"}.`);
      this.emitProgress(onProgress, "enable-gsi", "ready", cs2Running && !alreadyConnected
        ? "Setup complete. CS2 is already open, so restart it once."
        : "Setup complete. Launch CS2 and enter a game mode.");
    } catch (error) {
      const failedStage = this.setupStage;
      this.trace(`FAILED at ${failedStage}: ${this.errorMessage(error)}`);
      if (listenerStarted) {
        try { await this.withTimeout(this.server.stop(), 2_000, "Listener cleanup timed out"); } catch { }
      }
      if (newConfigPath) {
        try { await this.withTimeout(removeGsiConfig(newConfigPath), 2_000, "Config cleanup timed out"); } catch { }
      }
      this.globals.gsiEnabled = false;
      this.globals.gsiConfigPath = undefined;
      this.updateStatus({
        gsiConfigured: false,
        gsiConnected: false,
        gsiRestartRequired: false,
        setupStage: failedStage,
        detectedCs2Path: this.detectedCs2Path,
        listenerPort: undefined,
        configPath: undefined,
        error: `${this.errorMessage(error)} Failed stage: ${failedStage}.`
      });
      this.emitProgress(onProgress, "enable-gsi", failedStage, `Failed: ${this.errorMessage(error)}`);
      throw error;
    }
  }

  private async disableGsi(): Promise<void> {
    await this.server.stop();
    if (this.globals.gsiConfigPath) await removeGsiConfig(this.globals.gsiConfigPath);
    this.globals.gsiEnabled = false;
    this.globals.gsiConfigPath = undefined;
    await this.saveGlobals();
    this.setupStage = "idle";
    this.updateStatus({
      gsiConfigured: false,
      gsiConnected: false,
      gsiRestartRequired: false,
      setupStage: "idle",
      listenerPort: undefined,
      configPath: undefined,
      error: undefined
    });
  }

  private async runDiagnostics(manualCs2Path?: string, onProgress?: PiProgress): Promise<string> {
    const manualPath = manualCs2Path?.trim() || this.globals.manualCs2Path;
    const lines: string[] = [];
    const started = Date.now();
    const add = (label: string, ok: boolean, detail: string, elapsed?: number) => {
      lines.push(`${ok ? "PASS" : "FAIL"} | ${label}${elapsed === undefined ? "" : ` | ${elapsed}ms`} | ${detail}`);
    };
    const timed = async <T>(label: string, operation: () => Promise<T>, timeoutMs = DIAGNOSTIC_STEP_TIMEOUT_MS): Promise<T | undefined> => {
      const stepStart = Date.now();
      this.emitProgress(onProgress, "run-diagnostics", "diagnostics", `Testing ${label}…`);
      try {
        const result = await this.withTimeout(operation(), timeoutMs, `${label} timed out after ${timeoutMs}ms`);
        add(label, true, "OK", Date.now() - stepStart);
        return result;
      } catch (error) {
        add(label, false, this.errorMessage(error), Date.now() - stepStart);
        return undefined;
      }
    };

    lines.push("PackRat CS2 Competitive Dashboard Advanced Diagnostics");
    lines.push(`Timestamp: ${new Date().toISOString()}`);
    lines.push(`Platform: ${process.platform} ${process.arch}`);
    lines.push(`Node: ${process.version}`);
    lines.push(`Manual override: ${manualPath || "<automatic detection>"}`);
    lines.push(`Saved CS2 path: ${this.globals.cs2InstallPath || "<none>"}`);
    lines.push(`Saved GSI config: ${this.globals.gsiConfigPath || "<none>"}`);
    lines.push(`Runtime listener: ${this.server.listening ? `LISTENING on ${this.server.port}` : "stopped"}`);
    lines.push(`Runtime GSI connected: ${this.store.get().status.gsiConnected ? "yes" : "no"}`);
    lines.push("");

    const running = await timed("cs2.exe process check", () => this.detectCs2Running(), 2_500);
    if (running !== undefined) lines.push(`INFO | cs2.exe running | ${running ? "yes" : "no"}`);

    const settings = await timed("Stream Deck global settings read", async () => streamDeck.settings.getGlobalSettings() as Promise<unknown>, 2_500);
    if (settings !== undefined) lines.push("INFO | Stream Deck settings channel | responsive");

    const cs2 = await timed("CS2 install resolution", () => locateCs2Install(manualPath), 7_500);
    if (cs2) {
      lines.push(`INFO | installDir | ${cs2.installDir}`);
      lines.push(`INFO | cfgDir | ${cs2.cfgDir}`);
      lines.push(`INFO | steamRoot | ${cs2.steamRoot}`);
      lines.push(`INFO | libraryRoot | ${cs2.libraryRoot}`);

      const probePath = path.join(cs2.cfgDir, `.packrat-diagnostic-${process.pid}.tmp`);
      const writable = await timed("CS2 cfg write/delete probe", async () => {
        await writeFile(probePath, "PackRat diagnostic probe\n", "utf8");
        await rm(probePath, { force: true });
        return true;
      }, 3_000);
      if (writable) lines.push("INFO | cfg permissions | writable");

      const expectedConfig = path.join(cs2.cfgDir, GSI_FILENAME);
      const configExists = await timed("Existing PackRat GSI config check", async () => {
        try {
          await access(expectedConfig);
          return true;
        } catch {
          return false;
        }
      }, 2_000);
      if (configExists !== undefined) {
        lines.push(`INFO | PackRat config | ${configExists ? `present at ${expectedConfig}` : "not installed"}`);
        if (configExists) {
          const configText = await timed("Existing GSI config read", () => readFile(expectedConfig, "utf8"), 2_000);
          if (typeof configText === "string") {
            lines.push(`INFO | GSI localhost URI | ${/127\.0\.0\.1:\d+\/gsi/.test(configText) ? "valid" : "missing or invalid"}`);
            lines.push(`INFO | GSI auth token field | ${/"token"\s+"[^"]+"/.test(configText) ? "present" : "missing"}`);
          }
        }
      }
    }

    if (this.server.listening) {
      add("localhost listener probe", true, `Runtime listener already active on 127.0.0.1:${this.server.port}`);
    } else {
      const probeServer = new GsiServer();
      const probePort = await timed("localhost listener bind", () => probeServer.start({
        token: createGsiToken(),
        preferredPort: this.globals.gsiPort,
        onPayload: () => undefined
      }), 3_000);
      if (probePort !== undefined) {
        lines.push(`INFO | localhost listener test port | 127.0.0.1:${probePort}`);
        await timed("localhost listener close", () => probeServer.stop(), 2_500);
      }
    }

    lines.push("");
    lines.push("Setup trace from the most recent Enable attempt:");
    if (this.setupTrace.length) lines.push(...this.setupTrace.map((entry) => `TRACE | ${entry}`));
    else lines.push("TRACE | No setup trace recorded in this plugin process yet.");
    lines.push("");
    lines.push(`Diagnostics total: ${Date.now() - started}ms`);
    lines.push("Secrets are intentionally omitted from this report.");

    this.lastDiagnosticReport = lines.join("\n");
    this.emitProgress(onProgress, "run-diagnostics", "diagnostics", "Diagnostics complete.");
    return this.lastDiagnosticReport;
  }

  private ingest(payload: Parameters<typeof normalizeGsiPayload>[0]): void {
    const before = this.store.get();
    const live = normalizeGsiPayload(payload);
    const session = this.sessionTracker.ingest(live);
    this.setupStage = "ready";
    this.publish({
      live,
      session,
      status: {
        ...before.status,
        cs2Running: true,
        gsiConnected: true,
        gsiConfigured: true,
        gsiRestartRequired: false,
        setupStage: "ready",
        lastPayloadAt: live.receivedAt,
        error: undefined
      }
    });

    if (this.onlineEnabled && session.matches > before.session.matches) {
      setTimeout(() => void this.refreshOnline(true), 30_000);
    }
  }

  private async refreshOnline(force: boolean): Promise<void> {
    const identity = this.globals.steamProfile?.trim();
    if (!identity) {
      this.publish({ online: emptyOnlineSnapshot() });
      return;
    }

    const current = this.store.get().online;
    if (!force && current.updatedAt && Date.now() - current.updatedAt < ONLINE_PROFILE_REFRESH_MS) return;
    if (this.onlineRefresh) return this.onlineRefresh;

    this.onlineAbort?.abort();
    const controller = new AbortController();
    this.onlineAbort = controller;
    this.publish({ online: { ...current, requestedIdentity: identity, refreshing: true, error: undefined } });

    this.onlineRefresh = (async () => {
      try {
        const result = await this.providerClient.getProfile(identity, {
          faceitApiKey: this.globals.faceitApiKey,
          leetifyApiKey: this.globals.leetifyApiKey
        }, controller.signal);
        if (!controller.signal.aborted) this.publish({ online: result });
      } catch (error) {
        if (controller.signal.aborted) return;
        const message = this.errorMessage(error);
        const failed = emptyOnlineSnapshot(identity);
        failed.updatedAt = Date.now();
        failed.error = message;
        failed.leetify.status = this.globals.leetifyApiKey ? "offline" : "not_configured";
        failed.leetify.message = this.globals.leetifyApiKey ? message : "Add your Leetify API key in setup";
        failed.faceit.status = this.globals.faceitApiKey ? "offline" : "not_configured";
        failed.faceit.message = this.globals.faceitApiKey ? message : "Add your FACEIT API key in setup";
        this.publish({ online: failed });
      } finally {
        this.onlineRefresh = undefined;
      }
    })();

    return this.onlineRefresh;
  }

  private checkConnectionFreshness(): void {
    const current = this.store.get();
    const last = current.status.lastPayloadAt;
    if (current.status.gsiConnected && last && Date.now() - last > 15_000) {
      this.updateStatus({ gsiConnected: false });
    }
  }

  private async detectCs2Running(): Promise<boolean> {
    try {
      const { stdout } = await execFileAsync("tasklist.exe", ["/FI", "IMAGENAME eq cs2.exe", "/NH"], {
        windowsHide: true,
        timeout: 1_500
      });
      return /(^|\s)cs2\.exe(\s|$)/im.test(stdout);
    } catch {
      return false;
    }
  }

  private openProfilesFolder(): void {
    execFile("explorer.exe", [PROFILES_DIR], { windowsHide: true });
  }

  private commandState(command: string, message: string): Record<string, unknown> {
    return {
      ...this.publicState(),
      commandResult: { command, ok: true, message }
    };
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        promise,
        new Promise<T>((_, reject) => {
          timer = setTimeout(() => reject(new Error(message)), timeoutMs);
        })
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private setSetupStage(stage: SetupStage, onProgress?: PiProgress, command = "enable-gsi", message?: string): void {
    this.setupStage = stage;
    if (message) {
      this.trace(`${stage}: ${message}`);
      this.emitProgress(onProgress, command, stage, message);
    }
  }

  private emitProgress(onProgress: PiProgress | undefined, command: string, stage: string, message: string, details?: Record<string, unknown>): void {
    if (!onProgress) return;
    const payload = {
      ...this.publicState(),
      type: "command-progress",
      commandProgress: { command, stage, message, ...(details || {}) }
    };
    try {
      const result = onProgress(payload);
      if (result && typeof (result as Promise<void>).catch === "function") {
        void (result as Promise<void>).catch(() => undefined);
      }
    } catch {
      // Progress reporting must never block the actual command.
    }
  }

  private trace(message: string): void {
    const stamp = new Date().toISOString().slice(11, 23);
    this.setupTrace.push(`${stamp} ${message}`);
    if (this.setupTrace.length > 60) this.setupTrace.splice(0, this.setupTrace.length - 60);
  }

  private updateStatus(patch: Partial<RuntimeStatus>): void {
    const current = this.store.get();
    this.store.set({ ...current, status: { ...current.status, ...patch } });
  }

  private publish(patch: Partial<DashboardSnapshot>): void {
    this.store.set({ ...this.store.get(), ...patch });
  }

  private async saveGlobals(): Promise<void> {
    await streamDeck.settings.setGlobalSettings(this.globals as never);
  }

  private publicState(): Record<string, unknown> {
    const snapshot = this.store.get();
    return {
      type: "status",
      status: {
        ...snapshot.status,
        setupStage: this.setupStage,
        detectedCs2Path: this.detectedCs2Path ?? snapshot.status.detectedCs2Path
      },
      session: snapshot.session,
      online: snapshot.online,
      account: {
        steamProfile: this.globals.steamProfile ?? "",
        steamConfigured: Boolean(this.globals.steamProfile),
        faceitKeyConfigured: Boolean(this.globals.faceitApiKey),
        leetifyKeyConfigured: Boolean(this.globals.leetifyApiKey)
      },
      setup: {
        manualCs2Path: this.globals.manualCs2Path ?? "",
        trace: this.setupTrace
      },
      diagnostics: {
        report: this.lastDiagnosticReport
      }
    };
  }

  private parseCommand(payload: unknown): PiCommand | undefined {
    if (!payload || typeof payload !== "object") return undefined;
    const candidate = payload as Record<string, unknown>;
    if (candidate.type === "get-status") return { type: "get-status" };
    if (candidate.type === "disable-gsi") return { type: "disable-gsi" };
    if (candidate.type === "open-profiles-folder") return { type: "open-profiles-folder" };
    if (candidate.type === "reset-session") return { type: "reset-session" };
    if (candidate.type === "refresh-online") return { type: "refresh-online" };
    if (candidate.type === "enable-gsi") {
      return { type: "enable-gsi", manualCs2Path: typeof candidate.manualCs2Path === "string" ? candidate.manualCs2Path : undefined };
    }
    if (candidate.type === "run-diagnostics") {
      return { type: "run-diagnostics", manualCs2Path: typeof candidate.manualCs2Path === "string" ? candidate.manualCs2Path : undefined };
    }
    if (candidate.type === "set-steam-profile") {
      return { type: "set-steam-profile", steamProfile: typeof candidate.steamProfile === "string" ? candidate.steamProfile : undefined };
    }
    if (candidate.type === "set-provider-keys") {
      return {
        type: "set-provider-keys",
        faceitApiKey: typeof candidate.faceitApiKey === "string" ? candidate.faceitApiKey : undefined,
        leetifyApiKey: typeof candidate.leetifyApiKey === "string" ? candidate.leetifyApiKey : undefined
      };
    }
    if (candidate.type === "clear-provider-key" && (candidate.provider === "faceit" || candidate.provider === "leetify")) {
      return { type: "clear-provider-key", provider: candidate.provider };
    }
    return undefined;
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
