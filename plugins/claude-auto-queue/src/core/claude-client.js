import { execFile } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const MIN_CLAUDE_VERSION = "2.1.163";

export function parseClaudeVersion(value) {
  const match = String(value ?? "").match(/(?:^|\s|v)(\d+)\.(\d+)\.(\d+)(?:\b|$)/i);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function compareVersions(left, right) {
  const a = Array.isArray(left) ? left : parseClaudeVersion(left);
  const b = Array.isArray(right) ? right : parseClaudeVersion(right);
  if (!a || !b) return null;
  for (let i = 0; i < 3; i += 1) {
    if (a[i] > b[i]) return 1;
    if (a[i] < b[i]) return -1;
  }
  return 0;
}

export function isClaudeVersionSupported(value) {
  const comparison = compareVersions(value, MIN_CLAUDE_VERSION);
  return comparison !== null && comparison >= 0;
}

function extensionVersion(name) {
  const match = String(name ?? "").match(/^anthropic\.claude-code-(\d+\.\d+\.\d+)(?:-.+)?$/i);
  return match?.[1] ?? null;
}

export function resolveVsCodeBundledClaude({
  platform = process.platform,
  home = os.homedir(),
  exists = existsSync,
  readDir = readdirSync
} = {}) {
  if (platform !== "win32") return null;

  const win = path.win32;
  const roots = [
    win.join(home, ".vscode", "extensions"),
    win.join(home, ".vscode-insiders", "extensions"),
    win.join(home, ".cursor", "extensions"),
    win.join(home, ".windsurf", "extensions")
  ];
  const matches = [];

  for (const root of roots) {
    let entries;
    try {
      entries = readDir(root, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const name = typeof entry === "string" ? entry : entry?.name;
      if (!name || !/^anthropic\.claude-code-/i.test(name)) continue;
      if (typeof entry?.isDirectory === "function" && !entry.isDirectory()) continue;
      const binary = win.join(root, name, "resources", "native-binary", "claude.exe");
      try {
        if (!exists(binary)) continue;
      } catch {
        continue;
      }
      matches.push({ binary, version: extensionVersion(name), name });
    }
  }

  matches.sort((left, right) => {
    if (left.version && right.version) {
      const comparison = compareVersions(right.version, left.version);
      if (comparison !== null && comparison !== 0) return comparison;
    } else if (left.version) {
      return -1;
    } else if (right.version) {
      return 1;
    }
    return right.name.localeCompare(left.name);
  });

  return matches[0]?.binary ?? null;
}

export function resolveClaudeCommand({
  platform = process.platform,
  home = os.homedir(),
  env = process.env,
  exists = existsSync,
  readDir = readdirSync
} = {}) {
  const candidates = [];

  if (platform === "win32") {
    const win = path.win32;
    candidates.push(
      win.join(home, ".local", "bin", "claude.exe"),
      win.join(home, ".local", "bin", "claude.cmd"),
      win.join(home, ".local", "bin", "claude")
    );

    const bundled = resolveVsCodeBundledClaude({ platform, home, exists, readDir });
    if (bundled) candidates.push(bundled);

    if (env.APPDATA) {
      candidates.push(
        win.join(env.APPDATA, "npm", "claude.cmd"),
        win.join(env.APPDATA, "npm", "claude.exe")
      );
    }
    if (env.LOCALAPPDATA) {
      candidates.push(win.join(env.LOCALAPPDATA, "Microsoft", "WinGet", "Links", "claude.exe"));
    }
  } else {
    const posix = path.posix;
    candidates.push(posix.join(home, ".local", "bin", "claude"));
    if (platform === "darwin") {
      candidates.push("/opt/homebrew/bin/claude", "/usr/local/bin/claude");
    }
  }

  for (const candidate of candidates) {
    try {
      if (exists(candidate)) return candidate;
    } catch {
      // Ignore an inaccessible optional location and continue to PATH lookup.
    }
  }
  return "claude";
}

export async function runClaude(args, { timeout = 5000, command = resolveClaudeCommand() } = {}) {
  const needsShell = process.platform === "win32" &&
    (command === "claude" || /\.(?:cmd|bat)$/i.test(command));
  const options = {
    timeout,
    windowsHide: true,
    maxBuffer: 1024 * 1024,
    shell: needsShell
  };
  return execFileAsync(command, args, options);
}

export async function getClaudeVersion() {
  try {
    const { stdout, stderr } = await runClaude(["--version"], { timeout: 4000 });
    const rawVersion = String(stdout || stderr || "").trim() || "unknown";
    const parsed = parseClaudeVersion(rawVersion);
    const compatible = parsed ? isClaudeVersionSupported(parsed) : false;
    return {
      ok: true,
      version: rawVersion,
      parsedVersion: parsed ? parsed.join(".") : null,
      compatible,
      minimumVersion: MIN_CLAUDE_VERSION,
      error: compatible
        ? null
        : parsed
          ? `Claude Code ${MIN_CLAUDE_VERSION} or newer is required for supported Stop-hook continuation.`
          : "Claude Code was found, but its version could not be determined."
    };
  } catch (error) {
    return {
      ok: false,
      version: null,
      parsedVersion: null,
      compatible: false,
      minimumVersion: MIN_CLAUDE_VERSION,
      error: error?.code === "ENOENT"
        ? "Claude Code was not found. PackRat checked the native install, VS Code extension bundle, npm/WinGet installs, and PATH."
        : String(error?.message ?? error)
    };
  }
}

export async function listClaudeAgents() {
  try {
    const { stdout } = await runClaude(["agents", "--json"], { timeout: 5000 });
    const parsed = JSON.parse(stdout);
    if (!Array.isArray(parsed)) throw new Error("claude agents --json did not return an array.");
    return { ok: true, sessions: parsed };
  } catch (error) {
    return {
      ok: false,
      sessions: [],
      error: String(error?.message ?? error)
    };
  }
}

export function startClaudePoller(service, { intervalMs = 5000, onStatus = () => {} } = {}) {
  let stopped = false;
  let timer = null;

  const tick = async () => {
    if (stopped) return;
    const result = await listClaudeAgents();
    onStatus(result);
    if (result.ok) await service.reconcileAgents(result.sessions);
    if (!stopped) timer = setTimeout(tick, intervalMs);
  };

  void tick();
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}
