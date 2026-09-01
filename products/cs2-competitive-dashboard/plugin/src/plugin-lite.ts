import streamDeck, { action } from "@elgato/streamdeck";
import { LiveMetricActionBase } from "./actions/live-metric.js";
import { StatusActionBase } from "./actions/status.js";
import { LITE_LIVE_METRICS } from "./core/types.js";
import { hostDiagnostics } from "./diagnostics/host.js";
import { GsiHostService } from "./gsi/host-service.js";
import { DashboardRuntime } from "./runtime.js";
import { patchRuntimeStatus } from "./runtime-bridge.js";

const runtime = new DashboardRuntime();
const gsiHost = new GsiHostService(runtime);
streamDeck.logger.setLevel("info");

@action({ UUID: "com.packrat.cs2-competitive-dashboard-lite.live" })
class LiteLiveMetricAction extends LiveMetricActionBase {
  constructor() { super(runtime, LITE_LIVE_METRICS, "score"); }
}

@action({ UUID: "com.packrat.cs2-competitive-dashboard-lite.status" })
class LiteStatusAction extends StatusActionBase {
  constructor() { super(runtime); }
}

streamDeck.actions.registerAction(new LiteLiveMetricAction());
streamDeck.actions.registerAction(new LiteStatusAction());

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
