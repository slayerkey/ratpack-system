import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

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
    return {
      ok: true,
      version: String(stdout || stderr || "").trim() || "unknown"
    };
  } catch (error) {
    return {
      ok: false,
      version: null,
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
