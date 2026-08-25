import streamDeck, { action } from "@elgato/streamdeck";
import { LiveMetricActionBase } from "./actions/live-metric.js";
import { OnlineMetricActionBase } from "./actions/online-metric.js";
import { COMPETITIVE_METRICS, FACEIT_METRICS } from "./actions/online-format.js";
import { SessionMetricActionBase } from "./actions/session-metric.js";
import { StatusActionBase } from "./actions/status.js";
import { PRO_LIVE_METRICS } from "./core/types.js";
import { ensureAutomaticGsi } from "./gsi/auto-setup.js";
import { DashboardRuntime } from "./runtime.js";

const runtime = new DashboardRuntime({ onlineEnabled: true });
streamDeck.logger.setLevel("info");

type UserGlobalSettings = {
  steamProfile?: string;
  faceitApiKey?: string;
  leetifyApiKey?: string;
  sessionResetNonce?: number;
  refreshNonce?: number;
};

let cachedUserSettings: UserGlobalSettings = {};
let settingsSync = Promise.resolve();

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

function queueUserSettings(next: UserGlobalSettings): void {
  const previous = cachedUserSettings;
  cachedUserSettings = next;

  settingsSync = settingsSync.then(async () => {
    if (previous.steamProfile !== next.steamProfile) {
      await runtime.handlePiCommand({ type: "set-steam-profile", steamProfile: next.steamProfile ?? "" });
    }

    if (previous.faceitApiKey !== next.faceitApiKey && !next.faceitApiKey) {
      await runtime.handlePiCommand({ type: "clear-provider-key", provider: "faceit" });
    }
    if (previous.leetifyApiKey !== next.leetifyApiKey && !next.leetifyApiKey) {
      await runtime.handlePiCommand({ type: "clear-provider-key", provider: "leetify" });
    }
    if (
      (previous.faceitApiKey !== next.faceitApiKey && next.faceitApiKey) ||
      (previous.leetifyApiKey !== next.leetifyApiKey && next.leetifyApiKey)
    ) {
      await runtime.handlePiCommand({
        type: "set-provider-keys",
        faceitApiKey: next.faceitApiKey,
        leetifyApiKey: next.leetifyApiKey
      });
    }

    if (previous.sessionResetNonce !== next.sessionResetNonce && next.sessionResetNonce !== undefined) {
      await runtime.handlePiCommand({ type: "reset-session" });
    }
    if (previous.refreshNonce !== next.refreshNonce && next.refreshNonce !== undefined) {
      await runtime.handlePiCommand({ type: "refresh-online" });
    }
  }).catch((error) => {
    streamDeck.logger.error("CS2 Dashboard: applying Property Inspector settings failed", error);
  });
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

await streamDeck.connect();
await runtime.initialize();

cachedUserSettings = userSettings(await streamDeck.settings.getGlobalSettings());
streamDeck.settings.onDidReceiveGlobalSettings((ev) => {
  queueUserSettings(userSettings(ev.settings));
});

void ensureAutomaticGsi(runtime);
