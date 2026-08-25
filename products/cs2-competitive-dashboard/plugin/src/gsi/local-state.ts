import { readFile, rename, rm, writeFile } from "node:fs/promises";
import { hostDiagnostics } from "../diagnostics/host.js";

export interface LocalGsiState {
  token: string;
  port?: number;
  cs2InstallPath?: string;
  configPath?: string;
}

export async function readLocalGsiState(): Promise<LocalGsiState | undefined> {
  try {
    const text = await readFile(hostDiagnostics.statePath, "utf8");
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

export async function writeLocalGsiState(state: LocalGsiState): Promise<void> {
  const temporary = `${hostDiagnostics.statePath}.tmp`;
  await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  await rm(hostDiagnostics.statePath, { force: true });
  await rename(temporary, hostDiagnostics.statePath);
}

export async function clearLocalGsiState(): Promise<void> {
  await rm(hostDiagnostics.statePath, { force: true });
}
