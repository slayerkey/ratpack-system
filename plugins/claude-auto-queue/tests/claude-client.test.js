import assert from "node:assert/strict";
import test from "node:test";

import {
  MIN_CLAUDE_VERSION,
  compareVersions,
  isClaudeVersionSupported,
  parseClaudeVersion,
  resolveClaudeCommand,
  resolveVsCodeBundledClaude
} from "../src/core/claude-client.js";

test("parses normal Claude Code version output", () => {
  assert.deepEqual(parseClaudeVersion("2.1.163 (Claude Code)"), [2, 1, 163]);
  assert.deepEqual(parseClaudeVersion("claude v2.1.216"), [2, 1, 216]);
  assert.deepEqual(parseClaudeVersion("2.2.0"), [2, 2, 0]);
  assert.equal(parseClaudeVersion("unknown"), null);
});

test("compares semantic versions numerically", () => {
  assert.equal(compareVersions("2.1.163", "2.1.163"), 0);
  assert.equal(compareVersions("2.1.164", "2.1.163"), 1);
  assert.equal(compareVersions("2.2.0", "2.1.999"), 1);
  assert.equal(compareVersions("2.1.162", "2.1.163"), -1);
  assert.equal(compareVersions("not-a-version", "2.1.163"), null);
});

test("requires the Claude Code release that introduced Stop additionalContext", () => {
  assert.equal(MIN_CLAUDE_VERSION, "2.1.163");
  assert.equal(isClaudeVersionSupported("2.1.162"), false);
  assert.equal(isClaudeVersionSupported("2.1.163"), true);
  assert.equal(isClaudeVersionSupported("2.1.216"), true);
  assert.equal(isClaudeVersionSupported("3.0.0"), true);
  assert.equal(isClaudeVersionSupported("unknown"), false);
});

test("finds the newest Claude Code CLI bundled with VS Code", () => {
  const home = "C:\\Users\\Ada";
  const vscodeRoot = "C:\\Users\\Ada\\.vscode\\extensions";
  const newest = "C:\\Users\\Ada\\.vscode\\extensions\\anthropic.claude-code-2.1.241-win32-x64\\resources\\native-binary\\claude.exe";
  const dirsByRoot = new Map([
    [vscodeRoot, [
      { name: "anthropic.claude-code-2.1.216-win32-x64", isDirectory: () => true },
      { name: "anthropic.claude-code-2.1.241-win32-x64", isDirectory: () => true },
      { name: "some.other-extension-1.0.0", isDirectory: () => true }
    ]]
  ]);

  assert.equal(
    resolveVsCodeBundledClaude({
      platform: "win32",
      home,
      readDir: (root) => {
        if (!dirsByRoot.has(root)) throw Object.assign(new Error("missing"), { code: "ENOENT" });
        return dirsByRoot.get(root);
      },
      exists: (value) => value === newest || value.includes("anthropic.claude-code-2.1.216-win32-x64")
    }),
    newest
  );
});

test("resolves common Windows Claude installs before relying on a possibly stale PATH", () => {
  const home = "C:\\Users\\Ada";
  const env = {
    APPDATA: "C:\\Users\\Ada\\AppData\\Roaming",
    LOCALAPPDATA: "C:\\Users\\Ada\\AppData\\Local"
  };
  const noExtensions = () => { throw Object.assign(new Error("missing"), { code: "ENOENT" }); };

  const native = "C:\\Users\\Ada\\.local\\bin\\claude.exe";
  assert.equal(
    resolveClaudeCommand({ platform: "win32", home, env, readDir: noExtensions, exists: (value) => value === native }),
    native
  );

  const npm = "C:\\Users\\Ada\\AppData\\Roaming\\npm\\claude.cmd";
  assert.equal(
    resolveClaudeCommand({ platform: "win32", home, env, readDir: noExtensions, exists: (value) => value === npm }),
    npm
  );

  assert.equal(
    resolveClaudeCommand({ platform: "win32", home, env, readDir: noExtensions, exists: () => false }),
    "claude"
  );
});

test("prefers the VS Code bundled CLI when no native Claude install exists", () => {
  const home = "C:\\Users\\Ada";
  const extensionRoot = "C:\\Users\\Ada\\.vscode\\extensions";
  const bundled = "C:\\Users\\Ada\\.vscode\\extensions\\anthropic.claude-code-2.1.241-win32-x64\\resources\\native-binary\\claude.exe";
  const npm = "C:\\Users\\Ada\\AppData\\Roaming\\npm\\claude.cmd";

  assert.equal(
    resolveClaudeCommand({
      platform: "win32",
      home,
      env: { APPDATA: "C:\\Users\\Ada\\AppData\\Roaming" },
      readDir: (root) => {
        if (root !== extensionRoot) throw Object.assign(new Error("missing"), { code: "ENOENT" });
        return [{ name: "anthropic.claude-code-2.1.241-win32-x64", isDirectory: () => true }];
      },
      exists: (value) => value === bundled || value === npm
    }),
    bundled
  );
});
