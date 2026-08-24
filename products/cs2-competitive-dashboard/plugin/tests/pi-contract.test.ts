import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";
import { sessionDisplay } from "../src/actions/format.js";

const html = readFileSync("static/ui/property-inspector.html", "utf8");
const pi = readFileSync("static/ui/pi.js", "utf8");
const runtime = readFileSync("src/runtime.ts", "utf8");

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

test("Property Inspector never silently accepts disconnected or stalled plugin commands", () => {
  assert.match(html, /id="transport-text"/);
  assert.match(pi, /setInteractiveState\(false\)/);
  assert.match(pi, /Stream Deck disconnected · retrying/);
  assert.match(pi, /Waiting for Stream Deck connection/);
  assert.match(pi, /COMMAND_WATCHDOG_MS\s*=\s*12_000/);
  assert.match(pi, /No response after 12 seconds/);
  assert.match(runtime, /PI_COMMAND_TIMEOUT_MS\s*=\s*10_000/);
  assert.match(runtime, /commandResult/);
});

test("Property Inspector explains the complete live tracking path", () => {
  assert.match(html, /How live tracking works/);
  assert.match(html, /writes a local Valve GSI config/);
  assert.match(html, /If CS2 is already open, restart CS2 once/);
  assert.match(html, /Connected to CS2/);
  assert.match(html, /does not need Steam, Leetify, or FACEIT API keys/);
  assert.match(pi, /GSI installed · restart CS2 once/);
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
