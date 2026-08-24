import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { sessionDisplay } from "../src/actions/format.js";

const html = readFileSync("static/ui/property-inspector.html", "utf8");
const pi = readFileSync("static/ui/pi.js", "utf8");

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

test("Property Inspector never silently accepts disconnected plugin commands", () => {
  assert.match(html, /id="transport-text"/);
  assert.match(pi, /setInteractiveState\(false\)/);
  assert.match(pi, /Stream Deck disconnected · retrying/);
  assert.match(pi, /Waiting for Stream Deck connection/);
});

test("Property Inspector explains the one-time CS2 restart path", () => {
  assert.match(pi, /GSI installed · restart CS2 once/);
  assert.match(pi, /Close and reopen CS2 once/);
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
