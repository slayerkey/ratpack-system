import streamDeck, { action } from "@elgato/streamdeck";
import { LiveMetricActionBase } from "./actions/live-metric.js";
import { StatusActionBase } from "./actions/status.js";
import { LITE_LIVE_METRICS } from "./core/types.js";
import { DashboardRuntime } from "./runtime.js";

const runtime = new DashboardRuntime();

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

await streamDeck.connect();
await runtime.initialize();
