import assert from "node:assert/strict";
import { highestPacketCheckpoint, latestProcessSegment, processRuntimeFingerprint, providersReadyTogether } from "./release-evidence-parse.mjs";

const oldFingerprint = "a".repeat(64);
const currentFingerprint = "b".repeat(64);
const old = [
  `2026-08-30T01:00:00.000Z | plugin process started | {"runtimeFingerprint":"${oldFingerprint}"}`,
  "2026-08-30T01:00:01.000Z | first GSI payload received | {\"providerAppId\":730}",
  "2026-08-30T01:00:30.000Z | GSI payload heartbeat | {\"requestCount\":300}"
].join("\n");
const current = [
  `2026-08-30T02:00:00.000Z | plugin process started | {"runtimeFingerprint":"${currentFingerprint}"}`,
  "2026-08-30T02:00:01.000Z | first GSI payload received | {\"providerAppId\":730}",
  "2026-08-30T02:00:30.000Z | GSI payload heartbeat | {\"requestCount\":300}",
  "2026-08-30T02:01:00.000Z | GSI payload heartbeat | {\"requestCount\":600}",
  "2026-08-30T02:01:10.000Z | provider refresh completed | {\"leetifyStatus\":\"ready\",\"faceitStatus\":\"ready\"}"
].join("\n");

const latest = latestProcessSegment(`${old}\n${current}\n`);
assert(!latest.includes("2026-08-30T01:00"), "latest process segment must discard prior process evidence");
assert(latest.includes("2026-08-30T02:00"), "latest process segment must keep current process evidence");
assert.equal(highestPacketCheckpoint(latest), 600, "highest packet heartbeat must be parsed");
assert.equal(providersReadyTogether(latest), true, "both providers ready in one refresh must pass");
assert.equal(processRuntimeFingerprint(latest), currentFingerprint, "latest process runtime fingerprint must be parsed");
assert.notEqual(processRuntimeFingerprint(latest), oldFingerprint, "prior process runtime fingerprint must not leak into latest evidence");
assert.equal(processRuntimeFingerprint("plugin process started | {}"), undefined, "missing runtime fingerprint must remain explicit");

const splitProviders = [
  "provider refresh completed | {\"leetifyStatus\":\"ready\",\"faceitStatus\":\"offline\"}",
  "provider refresh completed | {\"leetifyStatus\":\"offline\",\"faceitStatus\":\"ready\"}"
].join("\n");
assert.equal(providersReadyTogether(splitProviders), false, "separate provider-ready moments must not satisfy release evidence");
assert.equal(highestPacketCheckpoint("first GSI payload received"), 1, "first packet without heartbeat should report checkpoint 1");
assert.equal(highestPacketCheckpoint("no GSI evidence"), 0, "no packet evidence should report checkpoint 0");

console.log("CS2 release evidence parser self-test PASS");
