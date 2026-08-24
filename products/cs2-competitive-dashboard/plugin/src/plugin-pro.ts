import streamDeck, { action } from "@elgato/streamdeck";
import { LiveMetricActionBase } from "./actions/live-metric.js";
import { OnlineMetricActionBase } from "./actions/online-metric.js";
import { COMPETITIVE_METRICS, FACEIT_METRICS } from "./actions/online-format.js";
import { SessionMetricActionBase } from "./actions/session-metric.js";
import { StatusActionBase } from "./actions/status.js";
import { PRO_LIVE_METRICS } from "./core/types.js";
import { DashboardRuntime } from "./runtime.js";

const runtime = new DashboardRuntime({ onlineEnabled: true });

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
