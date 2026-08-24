import { execFile } from "node:child_process";
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

export async function runClaude(args, { timeout = 5000 } = {}) {
  const options = {
    timeout,
    windowsHide: true,
    maxBuffer: 1024 * 1024,
    shell: process.platform === "win32"
  };
  return execFileAsync("claude", args, options);
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
      error: error?.code === "ENOENT" ? "Claude Code was not found on PATH." : String(error?.message ?? error)
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
