import streamDeck, { action } from "@elgato/streamdeck";
import { LiveMetricActionBase } from "./actions/live-metric.js";
import { OnlineMetricActionBase } from "./actions/online-metric.js";
import { COMPETITIVE_METRICS, FACEIT_METRICS } from "./actions/online-format.js";
import { SessionMetricActionBase } from "./actions/session-metric.js";
import { StatusActionBase } from "./actions/status.js";
import { PRO_LIVE_METRICS } from "./core/types.js";
import { hostDiagnostics } from "./diagnostics/host.js";
import { GsiHostService } from "./gsi/host-service.js";
import { ONLINE_PROFILE_REFRESH_MS } from "./providers/config.js";
import { DashboardRuntime } from "./runtime.js";
import {
  applyRuntimeUserSettings,
  patchRuntimeStatus,
  refreshRuntimeOnline,
  resetRuntimeSession
} from "./runtime-bridge.js";

const runtime = new DashboardRuntime({ onlineEnabled: true });
const gsiHost = new GsiHostService(runtime);
streamDeck.logger.setLevel("info");

type UserGlobalSettings = {
  steamProfile?: string;
  faceitApiKey?: string;
  leetifyApiKey?: string;
  sessionResetNonce?: number;
  refreshNonce?: number;
};

let cachedUserSettings: UserGlobalSettings = {};
let onlineRefreshTimer: NodeJS.Timeout | undefined;

function userSettings(settings: object): UserGlobalSettings {
  const source = settings as Record<string, unknown>;
  return {
    steamProfile: typeof source.steamProfile === "string" ? source.steamProfile : undefined,
    faceitApiKey: typeof source.faceitApiKey === "string" ? source.faceitApiKey : undefined,
    leetifyApiKey: typeof source.leetifyApiKey === "string" ? source.leetifyApiKey : undefined,
    sessionResetNonce: typeof source.sessionResetNonce === "number" ? source.sessionResetNonce : undefined,
    refreshNonce: typeof source.refreshNonce === "number" ? source.refreshNonce : undefined
  };
}

async function withTimeout<T>(operation: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function applySettings(next: UserGlobalSettings, initial = false): void {
  const previous = cachedUserSettings;
  cachedUserSettings = next;
  applyRuntimeUserSettings(runtime, next);

  if (!initial && previous.sessionResetNonce !== next.sessionResetNonce && next.sessionResetNonce !== undefined) {
    resetRuntimeSession(runtime);
    hostDiagnostics.event("session reset requested through native global settings");
  }

  if (!initial && previous.refreshNonce !== next.refreshNonce && next.refreshNonce !== undefined) {
    void refreshRuntimeOnline(runtime, true).catch((error) => hostDiagnostics.error("manual provider refresh failed", error));
  }

  const providerChanged =
    previous.steamProfile !== next.steamProfile ||
    previous.faceitApiKey !== next.faceitApiKey ||
    previous.leetifyApiKey !== next.leetifyApiKey;
  if (!initial && providerChanged && next.steamProfile) {
    void refreshRuntimeOnline(runtime, true).catch((error) => hostDiagnostics.error("provider refresh after settings change failed", error));
  }
}

@action({ UUID: "com.packrat.cs2-competitive-dashboard-pro.live" })
class ProLiveMetricAction extends LiveMetricActionBase {
  constructor() { super(runtime, PRO_LIVE_METRICS, "score"); }
}

@action({ UUID: "com.packrat.cs2-competitive-dashboard-pro.session" })
class ProSessionMetricAction extends SessionMetricActionBase {
  constructor() { super(runtime); }
}

@action({ UUID: "com.packrat.cs2-competitive-dashboard-pro.competitive" })
class ProCompetitiveMetricAction extends OnlineMetricActionBase {
  constructor() { super(runtime, "competitive", COMPETITIVE_METRICS, "premier"); }
}

@action({ UUID: "com.packrat.cs2-competitive-dashboard-pro.faceit" })
class ProFaceitMetricAction extends OnlineMetricActionBase {
  constructor() { super(runtime, "faceit", FACEIT_METRICS, "elo"); }
}

@action({ UUID: "com.packrat.cs2-competitive-dashboard-pro.status" })
class ProStatusAction extends StatusActionBase {
  constructor() { super(runtime); }
}

streamDeck.actions.registerAction(new ProLiveMetricAction());
streamDeck.actions.registerAction(new ProSessionMetricAction());
streamDeck.actions.registerAction(new ProCompetitiveMetricAction());
streamDeck.actions.registerAction(new ProFaceitMetricAction());
streamDeck.actions.registerAction(new ProStatusAction());

streamDeck.system.onApplicationDidLaunch((ev) => {
  if (ev.application.toLowerCase() === "cs2.exe") runtime.setCs2Running(true);
});
streamDeck.system.onApplicationDidTerminate((ev) => {
  if (ev.application.toLowerCase() === "cs2.exe") runtime.setCs2Running(false);
});

hostDiagnostics.event("Stream Deck connection started", undefined, { setupStage: "streamdeck-connect" });
try {
  await streamDeck.connect();
  hostDiagnostics.event("Stream Deck connection succeeded", undefined, { streamDeckConnected: true });
} catch (error) {
  hostDiagnostics.error("Stream Deck connection failed", error, { streamDeckConnected: false });
  throw error;
}

// The local GSI path is deliberately first and contains no Stream Deck settings reads/writes.
// A broken or slow settings channel can no longer prevent CS2 live tracking from working.
try {
  await gsiHost.start();
} catch (error) {
  hostDiagnostics.error("automatic GSI host startup failed", error);
  patchRuntimeStatus(runtime, {
    gsiConfigured: false,
    gsiConnected: false,
    setupStage: "idle",
    error: error instanceof Error ? error.message : String(error)
  });
}

hostDiagnostics.event("global settings load started");
try {
  const raw = await withTimeout(streamDeck.settings.getGlobalSettings(), 2_500, "Stream Deck global settings read");
  cachedUserSettings = userSettings(raw);
  applySettings(cachedUserSettings, true);
  hostDiagnostics.event("global settings loaded", {
    steamProfileConfigured: Boolean(cachedUserSettings.steamProfile),
    faceitKeyConfigured: Boolean(cachedUserSettings.faceitApiKey),
    leetifyKeyConfigured: Boolean(cachedUserSettings.leetifyApiKey)
  }, { settingsChannel: "responsive" });
  if (cachedUserSettings.steamProfile) {
    void refreshRuntimeOnline(runtime, true).catch((error) => hostDiagnostics.error("initial provider refresh failed", error));
  }
} catch (error) {
  const timeout = error instanceof Error && /timed out/i.test(error.message);
  hostDiagnostics.error("global settings load failed; local GSI remains active", error, {
    settingsChannel: timeout ? "timeout" : "error"
  });
}

streamDeck.settings.onDidReceiveGlobalSettings((ev) => {
  hostDiagnostics.event("native global settings update received");
  applySettings(userSettings(ev.settings));
  if (hostDiagnostics.snapshot().settingsChannel !== "responsive") {
    hostDiagnostics.patch({ settingsChannel: "responsive" });
  }
});

onlineRefreshTimer = setInterval(() => {
  void refreshRuntimeOnline(runtime, false).catch((error) => hostDiagnostics.error("scheduled provider refresh failed", error));
}, ONLINE_PROFILE_REFRESH_MS);
onlineRefreshTimer.unref?.();
