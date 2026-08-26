import { randomBytes } from "node:crypto";
import { access, mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { hostDiagnostics, tokenFingerprint } from "../diagnostics/host.js";
import { currentProductFlavor, gsiFilenameForFlavor, LEGACY_SHARED_GSI_FILENAME } from "../host-flavor.js";
import { locateCs2Install, type Cs2Install } from "./steam-locator.js";

// Keep the dashboard configs distinct from both the older CS2 Live Stats plugin and
// each other. Lite and Pro may legitimately be installed at the same time during an
// upgrade, so CS2 should publish to both localhost listeners instead of last-writer-wins.
export const GSI_FILENAME = gsiFilenameForFlavor();

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
  const flavor = currentProductFlavor().toUpperCase();
  return `"PackRat CS2 Competitive Dashboard ${flavor}"
{
    "uri" "http://127.0.0.1:${port}/"
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

  hostDiagnostics.event("GSI config write started", {
    flavor: hostDiagnostics.flavor,
    installDir: cs2.installDir,
    cfgDir: cs2.cfgDir,
    configPath,
    port: options.port,
    tokenFingerprint: tokenFingerprint(token)
  }, {
    cs2InstallPath: cs2.installDir,
    cfgDir: cs2.cfgDir,
    configPath,
    tokenFingerprint: tokenFingerprint(token),
    setupStage: "config-write"
  });

  await mkdir(cs2.cfgDir, { recursive: true });
  await writeFile(temporaryPath, generateGsiConfig(options.port, token), { encoding: "utf8", mode: 0o600 });
  await rm(configPath, { force: true });
  await rename(temporaryPath, configPath);
  await access(configPath);

  // Remove only the obsolete shared dashboard config from pre flavor-separated builds.
  // Never remove the other current flavor's cfg because CS2 supports multiple GSI files.
  const legacyPath = path.join(cs2.cfgDir, LEGACY_SHARED_GSI_FILENAME);
  if (legacyPath !== configPath) {
    try {
      await rm(legacyPath, { force: true });
    } catch (error) {
      hostDiagnostics.error("legacy shared GSI config cleanup failed", error);
    }
  }

  hostDiagnostics.event("GSI config write succeeded", {
    flavor: hostDiagnostics.flavor,
    configPath,
    uri: `http://127.0.0.1:${options.port}/`
  }, { configInstalled: true, configPath });

  return { cs2, configPath, token, port: options.port };
}

export async function removeGsiConfig(configPath: string): Promise<void> {
  await rm(configPath, { force: true });
  hostDiagnostics.event("GSI config removed", { configPath }, { configInstalled: false, configPath: undefined });
}
