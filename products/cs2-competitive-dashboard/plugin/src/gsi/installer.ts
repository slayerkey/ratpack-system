import { randomBytes } from "node:crypto";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { locateCs2Install, type Cs2Install } from "./steam-locator.js";

// Keep this distinct from the older PackRat CS2 Live Stats plugin so both products
// can be installed at the same time without overwriting each other's Valve GSI config.
export const GSI_FILENAME = "gamestate_integration_packrat_cs2_dashboard.cfg";

export interface GsiInstallResult {
  cs2: Cs2Install;
  configPath: string;
  token: string;
  port: number;
}

export function createGsiToken(): string {
  return randomBytes(32).toString("base64url");
}

export function generateGsiConfig(port: number, token: string): string {
  return `"PackRat CS2 Competitive Dashboard"
{
    "uri" "http://127.0.0.1:${port}/gsi"
    "timeout" "5.0"
    "buffer" "0.1"
    "throttle" "0.1"
    "heartbeat" "10.0"
    "auth"
    {
        "token" "${token}"
    }
    "data"
    {
        "provider" "1"
        "map" "1"
        "map_round_wins" "1"
        "round" "1"
        "player_id" "1"
        "player_state" "1"
        "player_weapons" "1"
        "player_match_stats" "1"
    }
}
`;
}

export async function installGsiConfig(options: {
  port: number;
  token?: string;
  manualCs2Path?: string;
  cs2?: Cs2Install;
}): Promise<GsiInstallResult> {
  const cs2 = options.cs2 ?? await locateCs2Install(options.manualCs2Path);
  const token = options.token ?? createGsiToken();
  const configPath = path.join(cs2.cfgDir, GSI_FILENAME);
  const temporaryPath = `${configPath}.tmp`;

  await mkdir(cs2.cfgDir, { recursive: true });
  await writeFile(temporaryPath, generateGsiConfig(options.port, token), { encoding: "utf8", mode: 0o600 });
  await rm(configPath, { force: true });
  await rename(temporaryPath, configPath);

  return { cs2, configPath, token, port: options.port };
}

export async function removeGsiConfig(configPath: string): Promise<void> {
  await rm(configPath, { force: true });
}
