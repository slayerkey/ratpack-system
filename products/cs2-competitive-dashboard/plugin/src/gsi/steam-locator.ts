import { execFile } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const APP_ID = "730";

export interface Cs2Install {
  steamRoot: string;
  libraryRoot: string;
  installDir: string;
  cfgDir: string;
}

export function parseSteamLibraryPaths(vdf: string): string[] {
  const paths: string[] = [];
  const regex = /"path"\s+"([^"]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(vdf)) !== null) {
    const candidate = match[1]?.replaceAll("\\\\", "\\");
    if (candidate) paths.push(candidate);
  }
  return paths;
}

export function parseInstallDir(acf: string): string | undefined {
  return acf.match(/"installdir"\s+"([^"]+)"/)?.[1];
}

async function exists(candidate: string): Promise<boolean> {
  try {
    await access(candidate);
    return true;
  } catch {
    return false;
  }
}

async function steamRootFromRegistry(): Promise<string | undefined> {
  if (process.platform !== "win32") return undefined;
  try {
    const { stdout } = await execFileAsync("reg", [
      "query",
      "HKCU\\Software\\Valve\\Steam",
      "/v",
      "SteamPath"
    ]);
    const match = stdout.match(/SteamPath\s+REG_SZ\s+(.+)$/im);
    return match?.[1]?.trim().replaceAll("/", "\\");
  } catch {
    return undefined;
  }
}

function commonSteamRoots(): string[] {
  const roots = new Set<string>();
  const registryCandidates = [process.env["ProgramFiles(x86)"], process.env.ProgramFiles].filter(Boolean) as string[];
  for (const base of registryCandidates) roots.add(path.join(base, "Steam"));
  roots.add("C:\\Program Files (x86)\\Steam");
  roots.add("C:\\Program Files\\Steam");
  return [...roots];
}

export async function locateCs2Install(manualPath?: string): Promise<Cs2Install> {
  if (manualPath) {
    const direct = await resolveManualInstall(manualPath);
    if (direct) return direct;
    throw new Error("The selected path does not contain a valid CS2 installation");
  }

  const registryRoot = await steamRootFromRegistry();
  const candidates = [registryRoot, ...commonSteamRoots()].filter(Boolean) as string[];

  for (const steamRoot of [...new Set(candidates)]) {
    if (!(await exists(steamRoot))) continue;
    const result = await findInSteamRoot(steamRoot);
    if (result) return result;
  }

  throw new Error("Could not find Steam and Counter-Strike 2 automatically");
}

async function resolveManualInstall(manualPath: string): Promise<Cs2Install | undefined> {
  const normalized = path.resolve(manualPath);
  const cfgDir = path.join(normalized, "game", "csgo", "cfg");
  if (!(await exists(cfgDir))) return undefined;
  return {
    steamRoot: "manual",
    libraryRoot: "manual",
    installDir: normalized,
    cfgDir
  };
}

async function findInSteamRoot(steamRoot: string): Promise<Cs2Install | undefined> {
  const libraryRoots = new Set<string>([steamRoot]);
  const libraryFile = path.join(steamRoot, "steamapps", "libraryfolders.vdf");
  try {
    const vdf = await readFile(libraryFile, "utf8");
    for (const libraryRoot of parseSteamLibraryPaths(vdf)) libraryRoots.add(libraryRoot);
  } catch {
    // A default Steam library can still be valid even if libraryfolders.vdf is unavailable.
  }

  for (const libraryRoot of libraryRoots) {
    const appManifest = path.join(libraryRoot, "steamapps", `appmanifest_${APP_ID}.acf`);
    if (!(await exists(appManifest))) continue;

    try {
      const acf = await readFile(appManifest, "utf8");
      const installFolder = parseInstallDir(acf);
      if (!installFolder) continue;
      const installDir = path.join(libraryRoot, "steamapps", "common", installFolder);
      const cfgDir = path.join(installDir, "game", "csgo", "cfg");
      if (!(await exists(cfgDir))) continue;
      return { steamRoot, libraryRoot, installDir, cfgDir };
    } catch {
      continue;
    }
  }

  return undefined;
}
