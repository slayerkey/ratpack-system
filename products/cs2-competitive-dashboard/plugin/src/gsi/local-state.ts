import { readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { hostDiagnostics } from "../diagnostics/host.js";

export interface LocalGsiState {
  token: string;
  port?: number;
  cs2InstallPath?: string;
  configPath?: string;
}

async function readStateFile(candidate: string): Promise<LocalGsiState | undefined> {
  try {
    const text = await readFile(candidate, "utf8");
    const parsed = JSON.parse(text) as Partial<LocalGsiState>;
    if (typeof parsed.token !== "string" || parsed.token.length < 16) return undefined;
    return {
      token: parsed.token,
      port: typeof parsed.port === "number" ? parsed.port : undefined,
      cs2InstallPath: typeof parsed.cs2InstallPath === "string" ? parsed.cs2InstallPath : undefined,
      configPath: typeof parsed.configPath === "string" ? parsed.configPath : undefined
    };
  } catch {
    return undefined;
  }
}

export async function readLocalGsiState(): Promise<LocalGsiState | undefined> {
  const current = await readStateFile(hostDiagnostics.statePath);
  if (current) return current;

  // Migrate the pre-flavor state into Pro only. Lite intentionally starts with its
  // own token/port so installing both Marketplace products cannot make them fight.
  if (hostDiagnostics.flavor === "pro") {
    const legacy = path.join(hostDiagnostics.stateDir, "gsi.json");
    const migrated = await readStateFile(legacy);
    if (migrated) {
      hostDiagnostics.event("legacy shared GSI state found; migrating to Pro state", {
        legacyStatePath: legacy,
        preferredPort: migrated.port,
        savedInstallPath: migrated.cs2InstallPath
      });
      return migrated;
    }
  }

  return undefined;
}

export async function writeLocalGsiState(state: LocalGsiState): Promise<void> {
  const temporary = `${hostDiagnostics.statePath}.tmp`;
  await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  await rm(hostDiagnostics.statePath, { force: true });
  await rename(temporary, hostDiagnostics.statePath);

  if (hostDiagnostics.flavor === "pro") {
    await rm(path.join(hostDiagnostics.stateDir, "gsi.json"), { force: true });
  }
}

export async function clearLocalGsiState(): Promise<void> {
  await rm(hostDiagnostics.statePath, { force: true });
}
