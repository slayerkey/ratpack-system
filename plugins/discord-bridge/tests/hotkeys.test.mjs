import assert from "node:assert/strict";
import test from "node:test";
import { discordShortcutScript } from "../src/hotkeys.js";

test("mute shortcut emits Ctrl Shift M", () => {
  const script = discordShortcutScript("mute");
  assert.match(script, /17,0,0/);
  assert.match(script, /16,0,0/);
  assert.match(script, /77,0,0/);
});

test("deafen shortcut emits Ctrl Shift D", () => {
  const script = discordShortcutScript("deafen");
  assert.match(script, /17,0,0/);
  assert.match(script, /16,0,0/);
  assert.match(script, /68,0,0/);
});
