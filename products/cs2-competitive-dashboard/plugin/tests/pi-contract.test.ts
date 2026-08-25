import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";
import { sessionDisplay } from "../src/actions/format.js";

const html = readFileSync("static/ui/property-inspector.html", "utf8");
const pi = readFileSync("static/ui/pi.js", "utf8");
const runtime = readFileSync("src/runtime.ts", "utf8");
const installer = readFileSync("src/gsi/installer.ts", "utf8");
const autoSetup = readFileSync("src/gsi/auto-setup.ts", "utf8");
const pluginPro = readFileSync("src/plugin-pro.ts", "utf8");
const pluginLite = readFileSync("src/plugin-lite.ts", "utf8");
const liveAction = readFileSync("src/actions/live-metric.ts", "utf8");
const sessionAction = readFileSync("src/actions/session-metric.ts", "utf8");
const onlineAction = readFileSync("src/actions/online-metric.ts", "utf8");
const statusAction = readFileSync("src/actions/status.ts", "utf8");

const emptySession = {
  matches: 0,
  wins: 0,
  losses: 0,
  kills: 0,
  deaths: 0,
  assists: 0,
  damage: 0,
  rounds: 0,
  headshotKills: 0,
  kd: 0,
  adr: 0,
  hsPercent: 0,
  inMatch: false
};

test("Property Inspector exposes its Stream Deck callback before DOM load", () => {
  assert.match(html, /<script src="pi\.js"><\/script>/);
  assert.doesNotMatch(html, /<script src="pi\.js" defer>/);
  assert.match(pi, /window\.connectElgatoStreamDeckSocket\s*=/);
});

test("Property Inspector registers and requests plugin state over WebSocket", () => {
  const sent: Array<Record<string, unknown>> = [];
  let createdSocket: FakeWebSocket | undefined;

  class FakeWebSocket {
    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    readyState = FakeWebSocket.CONNECTING;
    onopen?: () => void;
    onmessage?: (event: { data: string }) => void;
    onerror?: () => void;
    onclose?: () => void;

    constructor(public readonly url: string) {
      createdSocket = this;
    }

    send(value: string): void {
      sent.push(JSON.parse(value) as Record<string, unknown>);
    }

    close(): void {
      this.readyState = 3;
    }

    open(): void {
      this.readyState = FakeWebSocket.OPEN;
      this.onopen?.();
    }
  }

  const windowObject: Record<string, unknown> = {
    PACKRAT_BUILD: { flavor: "pro", name: "CS2 Competitive Dashboard Pro", liveMetrics: [], sessionMetrics: ["record", "kd"] },
    setTimeout: (handler: () => void) => { handler(); return 1; }
  };

  const context = vm.createContext({
    window: windowObject,
    document: {
      body: null,
      addEventListener: () => undefined,
      getElementById: () => null,
      querySelectorAll: () => []
    },
    navigator: {},
    WebSocket: FakeWebSocket,
    clearTimeout: () => undefined,
    console
  });

  vm.runInContext(pi, context);
  const connect = windowObject.connectElgatoStreamDeckSocket as ((port: string, uuid: string, event: string, info: string, actionInfo: string) => void);
  assert.equal(typeof connect, "function");

  connect(
    "12345",
    "property-inspector-uuid",
    "registerPropertyInspector",
    "{}",
    JSON.stringify({
      action: "com.packrat.cs2-competitive-dashboard-pro.session",
      context: "action-context",
      payload: { settings: { metric: "kd" } }
    })
  );

  assert.ok(createdSocket);
  assert.equal(createdSocket.url, "ws://127.0.0.1:12345");
  createdSocket.open();

  assert.deepEqual(sent[0], { event: "registerPropertyInspector", uuid: "property-inspector-uuid" });
  assert.deepEqual(sent[1], {
    event: "getSettings",
    action: "com.packrat.cs2-competitive-dashboard-pro.session",
    context: "action-context"
  });
  assert.deepEqual(sent[2], {
    event: "sendToPlugin",
    action: "com.packrat.cs2-competitive-dashboard-pro.session",
    context: "action-context",
    payload: { type: "get-status" }
  });
});

test("live tracking is automatic and does not depend on a Property Inspector button", () => {
  assert.match(html, /Automatic setup/);
  assert.match(html, /automatically finds Steam and CS2/);
  assert.match(html, /There is no Enable button/);
  assert.match(pluginPro, /ensureAutomaticGsi\(runtime\)/);
  assert.match(pluginLite, /ensureAutomaticGsi\(runtime\)/);
  assert.match(autoSetup, /primary CS2 locator failed; retrying with proven Steam locator/);
  assert.match(autoSetup, /Counter-Strike Global Offensive/);
});

test("dashboard GSI config cannot overwrite the older CS2 Live Stats config", () => {
  assert.match(installer, /gamestate_integration_packrat_cs2_dashboard\.cfg/);
  assert.doesNotMatch(installer, /GSI_FILENAME = "gamestate_integration_packrat_cs2\.cfg"/);
});

test("Property Inspector reports command progress instead of silently stalling", () => {
  assert.match(html, /id="transport-text"/);
  assert.match(pi, /setInteractiveState\(false\)/);
  assert.match(pi, /Stream Deck disconnected · retrying/);
  assert.match(pi, /Waiting for Stream Deck connection/);
  assert.match(pi, /COMMAND_WATCHDOG_MS\s*=\s*15_000/);
  assert.match(pi, /No progress for 15 seconds/);
  assert.match(pi, /command-progress/);
  assert.match(runtime, /emitProgress/);
  assert.match(runtime, /Plugin received/);
  for (const actionFile of [liveAction, sessionAction, onlineAction, statusAction]) {
    assert.match(actionFile, /handlePiCommand\(ev\.payload, \(progress\)/);
    assert.match(actionFile, /setTimeout\(\(\) => void this\.refreshAll\(\), 0\)/);
  }
});

test("Property Inspector explains the complete automatic live tracking path", () => {
  assert.match(html, /Automatic setup/);
  assert.match(html, /installs its Valve GSI config/);
  assert.match(html, /first install while CS2 is already open, restart CS2 once/);
  assert.match(html, /Connected to CS2/);
  assert.match(html, /no API key required for live tracking/);
});

test("manual CS2 override remains accepted internally for support fallback", () => {
  assert.match(html, /CS2 path override/);
  assert.match(html, /game\\csgo\\cfg/);
  assert.match(html, /Both are accepted/);
});

test("Advanced Diagnostics remain available internally but are no longer required for normal setup", () => {
  assert.match(html, /id="diagnostics-panel" hidden/);
  assert.match(html, /id="run-diagnostics"/);
  assert.match(pi, /run-diagnostics/);
  assert.match(runtime, /runDiagnostics/);
  assert.match(runtime, /Secrets are intentionally omitted/);
});

test("Property Inspector makes provider ownership explicit", () => {
  assert.match(html, /Leetify · Premier & Competitive/);
  assert.match(html, /FACEIT · FACEIT Stats/);
  assert.match(html, /Leetify powers Premier and Competitive stats/);
  assert.match(html, /FACEIT powers FACEIT stats only/);
  assert.match(pi, /Leetify-backed Competitive stat/);
  assert.match(pi, /comes from FACEIT/);
});

test("Property Inspector exposes a manual bundled-profile fallback", () => {
  assert.match(html, /id="open-profiles"/);
  assert.match(html, /Open bundled profile files/);
  assert.match(pi, /open-profiles-folder/);
  assert.match(runtime, /openProfilesFolder/);
});

test("session metric labels are customer facing and immediately distinct", () => {
  assert.deepEqual(sessionDisplay("record", emptySession), { label: "SESSION", value: "0W 0L", subtitle: "0 MATCHES" });
  assert.deepEqual(sessionDisplay("matches", emptySession), { label: "MATCHES", value: "0" });
  assert.deepEqual(sessionDisplay("kd", emptySession), { label: "SESSION K/D", value: "0.00" });
  assert.deepEqual(sessionDisplay("adr", emptySession), { label: "SESSION ADR", value: "0.0" });
  assert.deepEqual(sessionDisplay("hs", emptySession), { label: "SESSION HS%", value: "0%" });
  assert.doesNotMatch(JSON.stringify([
    sessionDisplay("adr", emptySession),
    sessionDisplay("hs", emptySession)
  ]), /DERIVED/i);
});
