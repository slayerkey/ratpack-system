import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  HOOK_EVENTS,
  HOOK_HEADER,
  HOOK_URL,
  IntegrationManager,
  addPackRatHooks,
  getPackRatHookToken,
  hasPackRatHooks,
  removePackRatHooks
} from "../src/core/integration-manager.js";

const TEST_TOKEN = `v1:${"a".repeat(64)}`;

test("adds PackRat hooks without removing existing Claude settings or hooks", () => {
  const original = {
    model: "sonnet",
    permissions: { allow: ["Bash(git status)"] },
    hooks: {
      Stop: [
        {
          hooks: [{ type: "command", command: "echo existing" }]
        }
      ]
    }
  };

  const connected = addPackRatHooks(original, TEST_TOKEN);
  assert.equal(connected.model, "sonnet");
  assert.deepEqual(connected.permissions, original.permissions);
  assert.equal(connected.hooks.Stop[0].hooks[0].command, "echo existing");
  assert.equal(hasPackRatHooks(connected), true);
  assert.equal(getPackRatHookToken(connected), TEST_TOKEN);

  for (const event of HOOK_EVENTS) {
    assert.equal(
      connected.hooks[event].some((group) =>
        group.hooks?.some(
          (handler) => handler.url === HOOK_URL && handler.headers?.[HOOK_HEADER] === TEST_TOKEN
        )
      ),
      true,
      `${event} hook missing`
    );
  }

  assert.deepEqual(original.hooks.Stop[0].hooks, [{ type: "command", command: "echo existing" }]);
});

test("hook installation is idempotent for one token", () => {
  const once = addPackRatHooks({}, TEST_TOKEN);
  const twice = addPackRatHooks(once, TEST_TOKEN);
  for (const event of HOOK_EVENTS) {
    const handlers = twice.hooks[event]
      .flatMap((group) => group.hooks ?? [])
      .filter((handler) => handler.url === HOOK_URL);
    assert.equal(handlers.length, 1);
    assert.equal(handlers[0].headers[HOOK_HEADER], TEST_TOKEN);
  }
});

test("disconnect removes only PackRat handlers", () => {
  const original = {
    hooks: {
      Stop: [{ hooks: [{ type: "command", command: "echo keep-me" }] }]
    }
  };
  const connected = addPackRatHooks(original, TEST_TOKEN);
  const disconnected = removePackRatHooks(connected);
  assert.equal(hasPackRatHooks(disconnected), false);
  assert.equal(disconnected.hooks.Stop[0].hooks[0].command, "echo keep-me");
});

test("manager writes atomically, preserves a recovery backup, and uses a random hook token", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "claude-settings-"));
  const settingsPath = path.join(dir, ".claude", "settings.json");
  await import("node:fs/promises").then(({ mkdir }) => mkdir(path.dirname(settingsPath), { recursive: true }));
  const initial = { theme: "dark", hooks: { Stop: [{ hooks: [{ type: "command", command: "echo hi" }] }] } };
  await writeFile(settingsPath, JSON.stringify(initial), "utf8");

  const manager = new IntegrationManager(settingsPath);
  const connected = await manager.connect();
  assert.equal(connected.connected, true);
  assert.equal(connected.secureHookAuth, true);
  assert.equal(connected.needsReconnect, false);

  const backup = JSON.parse(await readFile(manager.backupPath, "utf8"));
  assert.deepEqual(backup, initial);

  const afterConnect = JSON.parse(await readFile(settingsPath, "utf8"));
  assert.equal(afterConnect.theme, "dark");
  assert.equal(hasPackRatHooks(afterConnect), true);
  const token = getPackRatHookToken(afterConnect);
  assert.match(token, /^v1:[0-9a-f]{64}$/);
  assert.notEqual(token, "1");
  assert.equal(manager.authorizeHookHeader(token), true);
  assert.equal(manager.authorizeHookHeader("1"), false);
  assert.equal(manager.authorizeHookHeader(`${token}x`), false);

  const disconnected = await manager.disconnect();
  assert.equal(disconnected.connected, false);
  assert.equal(manager.authorizeHookHeader(token), false);
  const afterDisconnect = JSON.parse(await readFile(settingsPath, "utf8"));
  assert.equal(afterDisconnect.theme, "dark");
  assert.equal(afterDisconnect.hooks.Stop[0].hooks[0].command, "echo hi");
});

test("a restarted manager recovers the installed hook token without exposing it in status", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "claude-settings-restart-"));
  const settingsPath = path.join(dir, ".claude", "settings.json");
  await import("node:fs/promises").then(({ mkdir }) => mkdir(path.dirname(settingsPath), { recursive: true }));
  await writeFile(settingsPath, JSON.stringify(addPackRatHooks({}, TEST_TOKEN)), "utf8");

  const restarted = new IntegrationManager(settingsPath);
  await restarted.initialize();
  assert.equal(restarted.authorizeHookHeader(TEST_TOKEN), true);
  assert.equal(restarted.authorizeHookHeader("wrong"), false);
  const status = await restarted.status();
  assert.equal(status.connected, true);
  assert.equal(status.secureHookAuth, true);
  assert.equal(Object.hasOwn(status, "hookToken"), false);
});

test("connect retries instead of overwriting a concurrent Claude settings edit", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "claude-settings-race-"));
  const settingsPath = path.join(dir, ".claude", "settings.json");
  await import("node:fs/promises").then(({ mkdir }) => mkdir(path.dirname(settingsPath), { recursive: true }));
  await writeFile(settingsPath, JSON.stringify({ theme: "dark" }), "utf8");

  const manager = new IntegrationManager(settingsPath);
  const originalWrite = manager.writeSettingsIfUnchanged.bind(manager);
  let injected = false;
  manager.writeSettingsIfUnchanged = async (settings, expectedRaw) => {
    if (!injected) {
      injected = true;
      await writeFile(
        settingsPath,
        JSON.stringify({ theme: "dark", concurrentSetting: "preserve-me" }),
        "utf8"
      );
    }
    return originalWrite(settings, expectedRaw);
  };

  const status = await manager.connect();
  assert.equal(status.connected, true);
  const finalSettings = JSON.parse(await readFile(settingsPath, "utf8"));
  assert.equal(finalSettings.concurrentSetting, "preserve-me");
  assert.equal(finalSettings.theme, "dark");
  assert.equal(hasPackRatHooks(finalSettings), true);
});
