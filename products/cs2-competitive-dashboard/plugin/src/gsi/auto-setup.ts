import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import streamDeck from "@elgato/streamdeck";
import type { DashboardRuntime } from "../runtime.js";

function exists(candidate: string): boolean {
  try {
    return fs.existsSync(candidate);
  } catch {
    return false;
  }
}

function steamRoots(): string[] {
  const roots = new Set<string>();
  if (process.platform === "win32") {
    try {
      const output = execSync('reg query "HKCU\\Software\\Valve\\Steam" /v SteamPath', {
        stdio: ["ignore", "pipe", "ignore"],
        timeout: 1_500,
        windowsHide: true
      }).toString();
      const match = output.match(/SteamPath\s+REG_SZ\s+(.+)/i);
      if (match?.[1]) roots.add(path.normalize(match[1].trim()));
    } catch {
      // Fall through to normal Steam locations.
    }

    for (const base of [process.env["ProgramFiles(x86)"], process.env.ProgramFiles]) {
      if (base) roots.add(path.join(base, "Steam"));
    }
    roots.add("C:\\Program Files (x86)\\Steam");
    roots.add("C:\\Program Files\\Steam");
  }
  return [...roots].filter(exists);
}

function libraries(steamRoot: string): string[] {
  const result = new Set<string>([steamRoot]);
  try {
    const text = fs.readFileSync(path.join(steamRoot, "steamapps", "libraryfolders.vdf"), "utf8");
    for (const match of text.matchAll(/"path"\s*"([^"]+)"/g)) {
      if (match[1]) result.add(match[1].replace(/\\\\/g, "\\"));
    }
  } catch {
    // The root library is still a valid fallback.
  }
  return [...result];
}

/**
 * Synchronous fallback copied from the older PackRat CS2 Live Stats plugin that is
 * already proven to locate CS2 successfully on real customer Windows hosts.
 */
export function findCs2InstallRootSync(): string | undefined {
  const installFolder = "Counter-Strike Global Offensive";
  for (const steamRoot of steamRoots()) {
    for (const libraryRoot of libraries(steamRoot)) {
      const installRoot = path.join(libraryRoot, "steamapps", "common", installFolder);
      const cfgDir = path.join(installRoot, "game", "csgo", "cfg");
      if (exists(cfgDir)) return installRoot;
    }
  }
  return undefined;
}

type CommandResult = {
  command?: string;
  ok?: boolean;
  message?: string;
};

function resultFrom(response: Record<string, unknown>): CommandResult | undefined {
  const candidate = response.commandResult;
  return candidate && typeof candidate === "object" ? candidate as CommandResult : undefined;
}

/**
 * Live tracking is critical functionality, so it configures itself on plugin boot.
 * The Property Inspector is status/configuration UI only; GSI never depends on a
 * custom PI button round trip.
 */
export async function ensureAutomaticGsi(runtime: DashboardRuntime): Promise<void> {
  streamDeck.logger.info("CS2 Dashboard: automatic GSI setup starting");

  let response = await runtime.handlePiCommand({ type: "enable-gsi" });
  let result = resultFrom(response);
  if (result?.ok) {
    streamDeck.logger.info(`CS2 Dashboard: automatic GSI setup ready${result.message ? ` - ${result.message}` : ""}`);
    return;
  }

  const fallbackRoot = findCs2InstallRootSync();
  if (!fallbackRoot) {
    streamDeck.logger.error(`CS2 Dashboard: automatic GSI setup failed${result?.message ? ` - ${result.message}` : ""}`);
    return;
  }

  streamDeck.logger.warn(`CS2 Dashboard: primary CS2 locator failed; retrying with proven Steam locator at ${fallbackRoot}`);
  response = await runtime.handlePiCommand({ type: "enable-gsi", manualCs2Path: fallbackRoot });
  result = resultFrom(response);

  if (result?.ok) {
    streamDeck.logger.info(`CS2 Dashboard: fallback GSI setup ready at ${fallbackRoot}`);
  } else {
    streamDeck.logger.error(`CS2 Dashboard: fallback GSI setup failed${result?.message ? ` - ${result.message}` : ""}`);
  }
}
