import assert from "node:assert/strict";
import test from "node:test";
import { DashboardRuntime } from "../src/runtime.js";
import { emptyOnlineSnapshot, type OnlineProfileSnapshot } from "../src/providers/types.js";

interface PendingCall {
  identity: string;
  signal?: AbortSignal;
  resolve: (snapshot: OnlineProfileSnapshot) => void;
  reject: (error: unknown) => void;
}

interface RuntimeInternals {
  providerClient: {
    getProfile(identity: string, credentials: unknown, signal?: AbortSignal): Promise<OnlineProfileSnapshot>;
  };
  globals: { steamProfile?: string; faceitApiKey?: string; leetifyApiKey?: string };
  refreshOnline(force: boolean): Promise<void>;
  onlineRefresh?: Promise<void>;
  onlineAbort?: AbortController;
}

function readySnapshot(identity: string): OnlineProfileSnapshot {
  const snapshot = emptyOnlineSnapshot(identity);
  snapshot.updatedAt = Date.now();
  snapshot.leetify = { status: "ready", competitiveRanks: [], recentMatches: [] };
  snapshot.faceit = { status: "ready", recentMatches: [] };
  return snapshot;
}

/** Settle pending microtasks so an aborted refresh runs its catch/finally. */
async function settle(): Promise<void> {
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
  await new Promise((resolve) => setImmediate(resolve));
}

function harness(identity = "identity-a") {
  const runtime = new DashboardRuntime({ onlineEnabled: true });
  const calls: PendingCall[] = [];
  const internals = runtime as unknown as RuntimeInternals;

  internals.providerClient = {
    getProfile(callIdentity, _credentials, signal) {
      return new Promise<OnlineProfileSnapshot>((resolve, reject) => {
        calls.push({ identity: callIdentity, signal, resolve, reject });
      });
    }
  };
  internals.globals = { steamProfile: identity, faceitApiKey: "test-faceit", leetifyApiKey: "test-leetify" };

  return { runtime, calls, internals };
}

test("background refreshes coalesce onto in-flight provider work", async () => {
  const { calls, internals } = harness();

  void internals.refreshOnline(false);
  const firstInFlight = internals.onlineRefresh;
  const firstController = internals.onlineAbort;

  void internals.refreshOnline(false);

  assert.equal(calls.length, 1, "a background refresh must not duplicate in-flight provider work");
  assert.equal(internals.onlineRefresh, firstInFlight, "a background refresh must reuse the in-flight refresh");
  assert.equal(internals.onlineAbort, firstController, "a background refresh must not replace the abort controller");
  assert.equal(calls[0]?.signal?.aborted, false, "a background refresh must not abort in-flight work");
});

test("a forced refresh aborts and replaces stale in-flight provider work", async () => {
  const { calls, internals } = harness();

  void internals.refreshOnline(false);
  const staleCall = calls[0];
  const stalePromise = internals.onlineRefresh;
  const staleController = internals.onlineAbort;

  // The customer saves a new Steam identity while the old request is still in flight.
  internals.globals.steamProfile = "identity-b";
  void internals.refreshOnline(true);

  assert.equal(calls.length, 2, "a forced refresh must start replacement provider work");
  assert.equal(staleCall?.signal?.aborted, true, "a forced refresh must abort the stale request");
  assert.equal(calls[1]?.identity, "identity-b", "the replacement request must use the newly requested identity");
  assert.equal(calls[1]?.signal?.aborted, false, "the replacement request must not be aborted");
  assert.notEqual(internals.onlineRefresh, stalePromise, "a forced refresh must replace the in-flight refresh");
  assert.notEqual(internals.onlineAbort, staleController, "a forced refresh must replace the abort controller");
});

test("stale completion cannot clear the newer in-flight refresh state", async () => {
  const { calls, internals } = harness();

  void internals.refreshOnline(false);
  const staleCall = calls[0];

  internals.globals.steamProfile = "identity-b";
  void internals.refreshOnline(true);
  const newPromise = internals.onlineRefresh;
  const newController = internals.onlineAbort;

  // The aborted stale request finally settles and runs its finally block.
  staleCall?.resolve(readySnapshot("identity-a"));
  await settle();

  assert.equal(internals.onlineRefresh, newPromise, "stale cleanup must not clear the newer in-flight refresh");
  assert.equal(internals.onlineAbort, newController, "stale cleanup must not clear the newer abort controller");
  assert.equal(newController?.signal.aborted, false, "the newer request must remain live after stale cleanup");
});

test("stale provider results cannot overwrite the newly requested identity", async () => {
  const { runtime, calls, internals } = harness();

  void internals.refreshOnline(false);
  const staleCall = calls[0];

  internals.globals.steamProfile = "identity-b";
  void internals.refreshOnline(true);
  const newCall = calls[1];

  // Stale work resolves late with data for the OLD identity.
  staleCall?.resolve(readySnapshot("identity-a"));
  await settle();

  let online = runtime.snapshot().online;
  assert.equal(online.requestedIdentity, "identity-b", "stale provider output must not republish the old identity");
  assert.equal(online.leetify.status, "not_configured", "stale provider output must not publish stale ready data");
  assert.equal(online.refreshing, true, "the newer request must still be reported as in flight");

  // The replacement request then completes normally and wins.
  newCall?.resolve(readySnapshot("identity-b"));
  await settle();

  online = runtime.snapshot().online;
  assert.equal(online.requestedIdentity, "identity-b", "the newly requested identity must win");
  assert.equal(online.leetify.status, "ready", "the replacement provider result must be published");
  assert.equal(internals.onlineRefresh, undefined, "completed replacement work must clear its own refresh state");
  assert.equal(internals.onlineAbort, undefined, "completed replacement work must clear its own abort controller");
});

test("an aborted stale provider failure does not publish a stale error state", async () => {
  const { runtime, calls, internals } = harness();

  void internals.refreshOnline(false);
  const staleCall = calls[0];

  internals.globals.steamProfile = "identity-b";
  void internals.refreshOnline(true);

  // Aborted requests usually reject; that rejection must stay silent.
  staleCall?.reject(new Error("The operation was aborted"));
  await settle();

  const online = runtime.snapshot().online;
  assert.equal(online.error, undefined, "an aborted stale request must not publish an error");
  assert.equal(online.requestedIdentity, "identity-b", "an aborted stale failure must not republish the old identity");
  assert.equal(online.refreshing, true, "the newer request must still be reported as in flight");
});
