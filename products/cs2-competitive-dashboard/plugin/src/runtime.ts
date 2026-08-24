import streamDeck from "@elgato/streamdeck";
import type { LiveState, RuntimeStatus, SessionMetrics } from "./core/types.js";
import { StateStore } from "./core/store.js";
import { createGsiToken, installGsiConfig, removeGsiConfig } from "./gsi/installer.js";
import { normalizeGsiPayload } from "./gsi/normalize.js";
import { GsiServer } from "./gsi/server.js";
import { SessionTracker } from "./session/session-tracker.js";

export interface DashboardSnapshot {
  live?: LiveState;
  session: SessionMetrics;
  status: RuntimeStatus;
}

type GlobalSettings = {
  gsiEnabled?: boolean;
  gsiPort?: number;
  gsiToken?: string;
  gsiConfigPath?: string;
  cs2InstallPath?: string;
  manualCs2Path?: string;
  steamProfile?: string;
};

type PiCommand =
  | { type: "get-status" }
  | { type: "enable-gsi"; manualCs2Path?: string }
  | { type: "disable-gsi" }
  | { type: "reset-session" }
  | { type: "set-steam-profile"; steamProfile?: string };

export class DashboardRuntime {
  private readonly server = new GsiServer();
  private readonly sessionTracker = new SessionTracker();
  private readonly store = new StateStore<DashboardSnapshot>({
    session: this.sessionTracker.snapshot(),
    status: {
      cs2Running: false,
      gsiConfigured: false,
      gsiConnected: false
    }
  });
  private globals: GlobalSettings = {};
  private disconnectTimer?: NodeJS.Timeout;

  subscribe(listener: (snapshot: DashboardSnapshot) => void): () => void {
    return this.store.subscribe(listener);
  }

  snapshot(): DashboardSnapshot {
    return this.store.get();
  }

  async initialize(): Promise<void> {
    this.globals = (await streamDeck.settings.getGlobalSettings()) as GlobalSettings;

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
          listenerPort: port,
          configPath: this.globals.gsiConfigPath,
          error: undefined
        });
      } catch (error) {
        this.updateStatus({ error: this.errorMessage(error) });
      }
    }

    this.disconnectTimer = setInterval(() => this.checkConnectionFreshness(), 2_000);
  }

  async shutdown(): Promise<void> {
    if (this.disconnectTimer) clearInterval(this.disconnectTimer);
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
    if (!command) return { type: "error", message: "Unknown command" };

    try {
      switch (command.type) {
        case "get-status":
          return this.publicState();
        case "enable-gsi":
          await this.enableGsi(command.manualCs2Path);
          return this.publicState();
        case "disable-gsi":
          await this.disableGsi();
          return this.publicState();
        case "reset-session":
          this.sessionTracker.reset();
          this.publish({ session: this.sessionTracker.snapshot() });
          return this.publicState();
        case "set-steam-profile":
          this.globals.steamProfile = command.steamProfile?.trim() || undefined;
          await this.saveGlobals();
          return this.publicState();
      }
    } catch (error) {
      const message = this.errorMessage(error);
      this.updateStatus({ error: message });
      return { type: "error", message, ...this.publicState() };
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
      gsiConfigured: true,
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
      listenerPort: undefined,
      configPath: undefined,
      error: undefined
    });
  }

  private ingest(payload: Parameters<typeof normalizeGsiPayload>[0]): void {
    const live = normalizeGsiPayload(payload);
    const session = this.sessionTracker.ingest(live);
    this.publish({
      live,
      session,
      status: {
        ...this.store.get().status,
        cs2Running: true,
        gsiConnected: true,
        gsiConfigured: true,
        lastPayloadAt: live.receivedAt,
        error: undefined
      }
    });
  }

  private checkConnectionFreshness(): void {
    const current = this.store.get();
    const last = current.status.lastPayloadAt;
    if (current.status.gsiConnected && last && Date.now() - last > 15_000) {
      this.updateStatus({ gsiConnected: false });
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
      account: {
        steamProfile: this.globals.steamProfile ?? "",
        steamConfigured: Boolean(this.globals.steamProfile)
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
    if (candidate.type === "reset-session") return { type: "reset-session" };
    if (candidate.type === "enable-gsi") {
      return { type: "enable-gsi", manualCs2Path: typeof candidate.manualCs2Path === "string" ? candidate.manualCs2Path : undefined };
    }
    if (candidate.type === "set-steam-profile") {
      return { type: "set-steam-profile", steamProfile: typeof candidate.steamProfile === "string" ? candidate.steamProfile : undefined };
    }
    return undefined;
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
