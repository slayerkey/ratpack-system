import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";
import { sessionDisplay } from "../src/actions/format.js";

const html = readFileSync("static/ui/property-inspector.html", "utf8");
const pi = readFileSync("static/ui/pi.js", "utf8");
const diagnostics = readFileSync("static/ui/diagnostics.js", "utf8");
const installer = readFileSync("src/gsi/installer.ts", "utf8");
const hostService = readFileSync("src/gsi/host-service.ts", "utf8");
const hostLog = readFileSync("src/diagnostics/host.ts", "utf8");
const hostFlavor = readFileSync("src/host-flavor.ts", "utf8");
const pluginPro = readFileSync("src/plugin-pro.ts", "utf8");
const pluginLite = readFileSync("src/plugin-lite.ts", "utf8");

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

test("Property Inspector fallback uses the canonical PackRat maker URL", () => {
  assert.match(pi, /https:\/\/marketplace\.elgato\.com\/maker\/packrat/);
  assert.doesNotMatch(pi, /marketplace\.elgato\.com\/%40packrat/);
});

test("Property Inspector registers and requests ordinary plugin state over WebSocket", () => {
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
    setTimeout: (handler: () => void) => { handler(); return 1; },
    setInterval: () => 1,
    clearInterval: () => undefined
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
    clearInterval: () => undefined,
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
  assert.ok(sent.some((message) => message.event === "getSettings"));
  assert.ok(sent.some((message) => message.event === "getGlobalSettings"));
  assert.ok(sent.some((message) => message.event === "sendToPlugin"));
});

test("local GSI startup no longer depends on Stream Deck global settings", () => {
  for (const entry of [pluginPro, pluginLite]) {
    assert.match(entry, /new GsiHostService\(runtime\)/);
    assert.match(entry, /await gsiHost\.start\(\)/);
    assert.doesNotMatch(entry, /ensureAutomaticGsi/);
    assert.doesNotMatch(entry, /await runtime\.initialize\(\)/);
  }
  assert.doesNotMatch(hostService, /streamDeck\.settings/);
  assert.match(hostService, /writeLocalGsiState/);
  assert.match(hostService, /live tracking remains active/);
  assert.match(pluginPro, /global settings load failed; local GSI remains active/);
});

test("dashboard GSI config matches the proven root URI while preserving security", () => {
  assert.match(installer, /gsiFilenameForFlavor/);
  assert.match(installer, /LEGACY_SHARED_GSI_FILENAME/);
  assert.match(installer, /http:\/\/127\.0\.0\.1:\$\{port\}\//);
  assert.doesNotMatch(installer, /\$\{port\}\/gsi/);
  assert.match(installer, /"auth"/);
  assert.match(installer, /"token"/);
});

test("Pro and Lite cannot overwrite each other's local GSI host identity", () => {
  assert.match(hostFlavor, /32123/);
  assert.match(hostFlavor, /32147/);
  assert.match(hostFlavor, /gamestate_integration_packrat_cs2_dashboard_\$\{flavor\}\.cfg/);
  assert.match(hostLog, /cs2-competitive-dashboard-\$\{this\.flavor\}\.log/);
  assert.match(hostLog, /gsi-\$\{this\.flavor\}\.json/);
  assert.match(diagnostics, /FIRST_PORT = flavor === "lite" \? 32147 : 32123/);
  assert.match(diagnostics, /state\?\.flavor !== flavor/);
});

test("persistent diagnostics are independent of Property Inspector RPC", () => {
  assert.match(hostLog, /plugin process started/);
  assert.match(hostLog, /uncaught exception/);
  assert.match(hostLog, /unhandled rejection/);
  assert.match(html, /id="host-diagnostics-panel"/);
  assert.doesNotMatch(html, /id="host-diagnostics-panel" hidden/);
  assert.match(html, /Open Log Folder/);
  assert.match(html, /Copy Diagnostic Summary/);
  assert.match(diagnostics, /\/packrat\/diagnostics/);
  assert.match(diagnostics, /\/packrat\/open-log-folder/);
  assert.match(diagnostics, /127\.0\.0\.1/);
  assert.doesNotMatch(diagnostics, /sendToPlugin/);
});

test("Property Inspector makes provider ownership explicit", () => {
  assert.match(html, /Leetify · Premier & Competitive/);
  assert.match(html, /FACEIT · FACEIT Stats/);
  assert.match(html, /Leetify powers Premier and Competitive stats/);
  assert.match(html, /FACEIT powers FACEIT stats only/);
  assert.match(pi, /LEETIFY_DEVELOPER_PAGE/);
  assert.match(pi, /FACEIT_DEVELOPER_PORTAL/);
});

test("Property Inspector keeps a manual bundled profile fallback for Rat Dev", () => {
  assert.match(html, /id="open-profiles"/);
  assert.match(html, /Open bundled profile files/);
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
