import { execFile } from "node:child_process";
import { access, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { hostDiagnostics, tokenFingerprint } from "../diagnostics/host.js";
import type { DashboardRuntime } from "../runtime.js";
import { ingestGsi, patchRuntimeStatus } from "../runtime-bridge.js";
import { createGsiToken, GSI_FILENAME, installGsiConfig } from "./installer.js";
import { readLocalGsiState, writeLocalGsiState } from "./local-state.js";
import { GsiServer } from "./server.js";
import { locateCs2Install, type Cs2Install } from "./steam-locator.js";

const execFileAsync = promisify(execFile);
const PROCESS_POLL_MS = 2_000;
const STALE_PACKET_MS = 15_000;
const PACKET_TRACE_EVERY = 300;

function knownSteamCandidates(): string[] {
  const values = new Set<string>();
  for (const base of [process.env["ProgramFiles(x86)"], process.env.ProgramFiles]) {
    if (base) values.add(path.join(base, "Steam"));
  }
  values.add("C:\\Program Files (x86)\\Steam");
  values.add("C:\\Program Files\\Steam");
  return [...values];
}

async function detectCs2Running(): Promise<boolean> {
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

async function proveCfgWritable(cs2: Cs2Install): Promise<boolean> {
  const probe = path.join(cs2.cfgDir, `.packrat-cs2-dashboard-${process.pid}.tmp`);
  try {
    await writeFile(probe, "PackRat CS2 diagnostic write probe\n", "utf8");
    await rm(probe, { force: true });
    return true;
  } catch (error) {
    hostDiagnostics.error("CFG write probe failed", error, { cfgWritable: false });
    try { await rm(probe, { force: true }); } catch { }
    return false;
  }
}

export class GsiHostService {
  private readonly server = new GsiServer();
  private monitor?: NodeJS.Timeout;

  constructor(private readonly runtime: DashboardRuntime) {}

  async start(): Promise<void> {
    hostDiagnostics.event("automatic GSI setup started", undefined, {
      setupStage: "automatic-setup",
      steamCandidates: knownSteamCandidates()
    });

    const saved = await readLocalGsiState();
    const token = saved?.token ?? createGsiToken();
    hostDiagnostics.patch({ tokenFingerprint: tokenFingerprint(token) });
    hostDiagnostics.event("local GSI state loaded", {
      stateFound: Boolean(saved),
      preferredPort: saved?.port,
      savedInstallPath: saved?.cs2InstallPath,
      tokenFingerprint: tokenFingerprint(token)
    });

    let cs2: Cs2Install;
    try {
      hostDiagnostics.event("CS2 install resolution started", {
        savedInstallPath: saved?.cs2InstallPath,
        steamCandidates: knownSteamCandidates()
      }, { setupStage: "finding-cs2" });
      cs2 = await locateCs2Install(saved?.cs2InstallPath);
    } catch (savedError) {
      if (saved?.cs2InstallPath) {
        hostDiagnostics.event("saved CS2 path failed; retrying automatic detection", { savedInstallPath: saved.cs2InstallPath, error: savedError });
        cs2 = await locateCs2Install();
      } else {
        hostDiagnostics.error("CS2 install resolution failed", savedError, { setupStage: "finding-cs2" });
        throw savedError;
      }
    }

    hostDiagnostics.event("CS2 install selected", {
      steamRoot: cs2.steamRoot,
      libraryRoot: cs2.libraryRoot,
      installDir: cs2.installDir,
      cfgDir: cs2.cfgDir
    }, {
      selectedSteamPath: cs2.steamRoot,
      cs2InstallPath: cs2.installDir,
      cfgDir: cs2.cfgDir,
      cfgExists: true
    });

    try {
      await access(cs2.cfgDir);
      hostDiagnostics.event("CFG folder exists", { cfgDir: cs2.cfgDir }, { cfgExists: true });
    } catch (error) {
      hostDiagnostics.error("CFG folder access failed", error, { cfgExists: false, setupStage: "finding-cs2" });
      throw error;
    }

    const writable = await proveCfgWritable(cs2);
    hostDiagnostics.event("CFG write probe complete", { cfgDir: cs2.cfgDir, writable }, { cfgWritable: writable });
    if (!writable) throw new Error(`CS2 cfg folder is not writable: ${cs2.cfgDir}`);

    const port = await this.server.start({
      token,
      preferredPort: saved?.port,
      onPayload: async (payload) => {
        const nextPacket = hostDiagnostics.snapshot().requestCount + 1;
        const traceSuccess = nextPacket === 1 || nextPacket % PACKET_TRACE_EVERY === 0;
        if (traceSuccess) hostDiagnostics.event("payload normalization started", { providerAppId: payload.provider?.appid, packet: nextPacket });
        try {
          ingestGsi(this.runtime, payload);
          hostDiagnostics.patch({ gsiConnected: true, setupStage: "connected" });
          if (traceSuccess) {
            hostDiagnostics.event("payload normalization succeeded", { providerAppId: payload.provider?.appid, packet: nextPacket });
            hostDiagnostics.event("runtime marked connected", { packet: nextPacket });
          }
        } catch (error) {
          hostDiagnostics.error("payload normalization failed", error);
          throw error;
        }
      }
    });

    let installed;
    try {
      installed = await installGsiConfig({ port, token, cs2 });
    } catch (error) {
      hostDiagnostics.error("GSI config installation failed", error, { configInstalled: false, setupStage: "config-write" });
      await this.server.stop();
      throw error;
    }

    // Persisting convenience state must never be allowed to undo a working listener/config.
    // This is the key architectural change from the previous implementation.
    try {
      await writeLocalGsiState({
        token,
        port,
        cs2InstallPath: cs2.installDir,
        configPath: installed.configPath
      });
      hostDiagnostics.event("local GSI state persisted", {
        port,
        cs2InstallPath: cs2.installDir,
        configPath: installed.configPath,
        tokenFingerprint: tokenFingerprint(token)
      });
    } catch (error) {
      hostDiagnostics.error("local GSI state persistence failed; live tracking remains active", error);
    }

    const cs2Running = await detectCs2Running();
    hostDiagnostics.event("CS2 process detection complete", { running: cs2Running }, { cs2Running });
    patchRuntimeStatus(this.runtime, {
      cs2Running,
      gsiConfigured: true,
      gsiConnected: false,
      gsiRestartRequired: cs2Running,
      setupStage: "ready",
      detectedCs2Path: cs2.installDir,
      listenerPort: port,
      configPath: installed.configPath,
      error: undefined
    });
    hostDiagnostics.patch({ setupStage: "ready" });
    hostDiagnostics.event("automatic GSI setup ready", {
      listenerUrl: `http://127.0.0.1:${port}/`,
      configPath: installed.configPath,
      cs2Running,
      restartRequired: cs2Running
    });

    this.startMonitor();
  }

  async stop(): Promise<void> {
    if (this.monitor) clearInterval(this.monitor);
    this.monitor = undefined;
    await this.server.stop();
  }

  private startMonitor(): void {
    if (this.monitor) clearInterval(this.monitor);
    this.monitor = setInterval(() => {
      void this.pollRuntimeState();
    }, PROCESS_POLL_MS);
  }

  private async pollRuntimeState(): Promise<void> {
    const cs2Running = await detectCs2Running();
    const diagnostics = hostDiagnostics.snapshot();
    const lastPacketMs = diagnostics.lastPacketAt ? Date.parse(diagnostics.lastPacketAt) : 0;
    const connected = lastPacketMs > 0 && Date.now() - lastPacketMs <= STALE_PACKET_MS;

    if (cs2Running !== diagnostics.cs2Running) {
      hostDiagnostics.event("CS2 process state changed", { running: cs2Running }, { cs2Running });
    }
    if (diagnostics.gsiConnected && !connected) {
      hostDiagnostics.event("GSI connection became stale", { lastPacketAt: diagnostics.lastPacketAt }, { gsiConnected: false });
    }

    patchRuntimeStatus(this.runtime, {
      cs2Running,
      gsiConnected: connected,
      ...(cs2Running ? {} : { gsiRestartRequired: false })
    });
  }
}

export function expectedDashboardConfigPath(cs2: Cs2Install): string {
  return path.join(cs2.cfgDir, GSI_FILENAME);
}
