import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  HOOK_EVENTS,
  HOOK_URL,
  IntegrationManager,
  addPackRatHooks,
  hasPackRatHooks,
  removePackRatHooks
} from "../src/core/integration-manager.js";

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

  const connected = addPackRatHooks(original);
  assert.equal(connected.model, "sonnet");
  assert.deepEqual(connected.permissions, original.permissions);
  assert.equal(connected.hooks.Stop[0].hooks[0].command, "echo existing");
  assert.equal(hasPackRatHooks(connected), true);

  for (const event of HOOK_EVENTS) {
    assert.equal(
      connected.hooks[event].some((group) =>
        group.hooks?.some((handler) => handler.url === HOOK_URL)
      ),
      true,
      `${event} hook missing`
    );
  }

  assert.deepEqual(original.hooks.Stop[0].hooks, [{ type: "command", command: "echo existing" }]);
});

test("hook installation is idempotent", () => {
  const once = addPackRatHooks({});
  const twice = addPackRatHooks(once);
  for (const event of HOOK_EVENTS) {
    const count = twice.hooks[event]
      .flatMap((group) => group.hooks ?? [])
      .filter((handler) => handler.url === HOOK_URL).length;
    assert.equal(count, 1);
  }
});

test("disconnect removes only PackRat handlers", () => {
  const original = {
    hooks: {
      Stop: [{ hooks: [{ type: "command", command: "echo keep-me" }] }]
    }
  };
  const connected = addPackRatHooks(original);
  const disconnected = removePackRatHooks(connected);
  assert.equal(hasPackRatHooks(disconnected), false);
  assert.equal(disconnected.hooks.Stop[0].hooks[0].command, "echo keep-me");
});

test("manager writes atomically, preserves a recovery backup, and disconnects surgically", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "claude-settings-"));
  const settingsPath = path.join(dir, ".claude", "settings.json");
  await import("node:fs/promises").then(({ mkdir }) => mkdir(path.dirname(settingsPath), { recursive: true }));
  const initial = { theme: "dark", hooks: { Stop: [{ hooks: [{ type: "command", command: "echo hi" }] }] } };
  await writeFile(settingsPath, JSON.stringify(initial), "utf8");

  const manager = new IntegrationManager(settingsPath);
  const connected = await manager.connect();
  assert.equal(connected.connected, true);

  const backup = JSON.parse(await readFile(manager.backupPath, "utf8"));
  assert.deepEqual(backup, initial);

  const afterConnect = JSON.parse(await readFile(settingsPath, "utf8"));
  assert.equal(afterConnect.theme, "dark");
  assert.equal(hasPackRatHooks(afterConnect), true);

  const disconnected = await manager.disconnect();
  assert.equal(disconnected.connected, false);
  const afterDisconnect = JSON.parse(await readFile(settingsPath, "utf8"));
  assert.equal(afterDisconnect.theme, "dark");
  assert.equal(afterDisconnect.hooks.Stop[0].hooks[0].command, "echo hi");
});
