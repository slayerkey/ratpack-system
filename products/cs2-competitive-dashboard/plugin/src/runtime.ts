import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import streamDeck from "@elgato/streamdeck";
import type { LiveState, RuntimeStatus, SessionMetrics } from "./core/types.js";
import { StateStore } from "./core/store.js";
import { createGsiToken, installGsiConfig, removeGsiConfig } from "./gsi/installer.js";
import { normalizeGsiPayload } from "./gsi/normalize.js";
import { GsiServer } from "./gsi/server.js";
import { ONLINE_PROFILE_REFRESH_MS } from "./providers/config.js";
import { ProviderClient } from "./providers/direct-client.js";
import { emptyOnlineSnapshot, type OnlineProfileSnapshot } from "./providers/types.js";
import { SessionTracker } from "./session/session-tracker.js";

const execFileAsync = promisify(execFile);
const PI_COMMAND_TIMEOUT_MS = 10_000;
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
  | { type: "open-profiles-folder" }
  | { type: "reset-session" }
  | { type: "set-steam-profile"; steamProfile?: string }
  | { type: "set-provider-keys"; faceitApiKey?: string; leetifyApiKey?: string }
  | { type: "clear-provider-key"; provider: "faceit" | "leetify" }
  | { type: "refresh-online" };

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
      gsiConnected: false
    },
    online: emptyOnlineSnapshot()
  });
  private globals: GlobalSettings = {};
  private disconnectTimer?: NodeJS.Timeout;
  private onlineTimer?: NodeJS.Timeout;
  private onlineAbort?: AbortController;
  private onlineRefresh?: Promise<void>;

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

        this.updateStatus({
          gsiConfigured: Boolean(this.globals.gsiConfigPath),
          gsiRestartRequired: false,
          listenerPort: port,
          configPath: this.globals.gsiConfigPath,
          error: undefined
        });
      } catch (error) {
        this.updateStatus({ error: this.errorMessage(error) });
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

  async handlePiCommand(payload: unknown): Promise<Record<string, unknown>> {
    const command = this.parseCommand(payload);
    if (!command) return { ...this.publicState(), type: "error", message: "Unknown command" };

    try {
      switch (command.type) {
        case "get-status":
          return this.publicState();
        case "enable-gsi":
          await this.withTimeout(
            this.enableGsi(command.manualCs2Path),
            PI_COMMAND_TIMEOUT_MS,
            "Live tracking setup took too long. Check the CS2 path or try again."
          );
          return this.commandState("enable-gsi", "Live tracking is enabled.");
        case "disable-gsi":
          await this.withTimeout(
            this.disableGsi(),
            PI_COMMAND_TIMEOUT_MS,
            "Disabling live tracking took too long. Restart the plugin and try again."
          );
          return this.commandState("disable-gsi", "Live tracking is disabled.");
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
      this.updateStatus({ error: message });
      return {
        ...this.publicState(),
        type: "error",
        message,
        commandResult: { command: command.type, ok: false, message }
      };
    }
  }

  private async enableGsi(manualCs2Path?: string): Promise<void> {
    const token = this.globals.gsiToken ?? createGsiToken();
    const port = await this.server.start({
      token,
      preferredPort: this.globals.gsiPort,
      onPayload: (payload) => this.ingest(payload)
    });

    const installed = await installGsiConfig({
      port,
      token,
      manualCs2Path: manualCs2Path?.trim() || this.globals.manualCs2Path
    });

    const cs2Running = this.store.get().status.cs2Running || await this.detectCs2Running();
    const alreadyConnected = this.store.get().status.gsiConnected;

    this.globals = {
      ...this.globals,
      gsiEnabled: true,
      gsiPort: port,
      gsiToken: token,
      gsiConfigPath: installed.configPath,
      cs2InstallPath: installed.cs2.installDir,
      manualCs2Path: manualCs2Path?.trim() || this.globals.manualCs2Path
    };
    await this.saveGlobals();

    this.updateStatus({
      cs2Running,
      gsiConfigured: true,
      gsiRestartRequired: cs2Running && !alreadyConnected,
      listenerPort: port,
      configPath: installed.configPath,
      error: undefined
    });
  }

  private async disableGsi(): Promise<void> {
    await this.server.stop();
    if (this.globals.gsiConfigPath) await removeGsiConfig(this.globals.gsiConfigPath);
    this.globals.gsiEnabled = false;
    this.globals.gsiConfigPath = undefined;
    await this.saveGlobals();
    this.updateStatus({
      gsiConfigured: false,
      gsiConnected: false,
      gsiRestartRequired: false,
      listenerPort: undefined,
      configPath: undefined,
      error: undefined
    });
  }

  private ingest(payload: Parameters<typeof normalizeGsiPayload>[0]): void {
    const before = this.store.get();
    const live = normalizeGsiPayload(payload);
    const session = this.sessionTracker.ingest(live);
    this.publish({
      live,
      session,
      status: {
        ...before.status,
        cs2Running: true,
        gsiConnected: true,
        gsiConfigured: true,
        gsiRestartRequired: false,
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
        failed.leetify.message = this.globals.leetifyApiKey ? message : "Add your free Leetify API key in setup";
        failed.faceit.status = this.globals.faceitApiKey ? "offline" : "not_configured";
        failed.faceit.message = this.globals.faceitApiKey ? message : "Add your free FACEIT API key in setup";
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
      const { stdout } = await execFileAsync("tasklist.exe", ["/FI", "IMAGENAME eq cs2.exe", "/NH"], { windowsHide: true });
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
      status: snapshot.status,
      session: snapshot.session,
      online: snapshot.online,
      account: {
        steamProfile: this.globals.steamProfile ?? "",
        steamConfigured: Boolean(this.globals.steamProfile),
        faceitKeyConfigured: Boolean(this.globals.faceitApiKey),
        leetifyKeyConfigured: Boolean(this.globals.leetifyApiKey)
      },
      setup: {
        manualCs2Path: this.globals.manualCs2Path ?? ""
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
