import { execFile } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const APP_ID = "730";
const FS_PROBE_TIMEOUT_MS = 1_500;
const REGISTRY_TIMEOUT_MS = 1_500;

export interface Cs2Install {
  steamRoot: string;
  libraryRoot: string;
  installDir: string;
  cfgDir: string;
}

type SteamLibrary = {
  path: string;
  hasCs2: boolean;
};

export function parseSteamLibraryPaths(vdf: string): string[] {
  return parseSteamLibraries(vdf).map((library) => library.path);
}

export function parseInstallDir(acf: string): string | undefined {
  return acf.match(/"installdir"\s+"([^"]+)"/)?.[1];
}

export function parseSteamLibraries(vdf: string): SteamLibrary[] {
  const libraries: SteamLibrary[] = [];
  const tokens = [...vdf.matchAll(/"((?:\\.|[^"\\])*)"|([{}])/g)].map((match) => match[1] !== undefined ? { type: "string" as const, value: match[1] } : { type: "brace" as const, value: match[2] });
  let index = 0;

  const parseObject = (): Record<string, unknown> => {
    const object: Record<string, unknown> = {};
    while (index < tokens.length) {
      const token = tokens[index];
      if (token?.type === "brace" && token.value === "}") {
        index += 1;
        break;
      }
      if (token?.type !== "string") {
        index += 1;
        continue;
      }
      const key = token.value;
      index += 1;
      const next = tokens[index];
      if (next?.type === "brace" && next.value === "{") {
        index += 1;
        object[key] = parseObject();
      } else if (next?.type === "string") {
        object[key] = next.value;
        index += 1;
      }
    }
    return object;
  };

  const root = parseObject();
  const folders = (root.libraryfolders ?? root.LibraryFolders ?? root) as Record<string, unknown>;
  for (const value of Object.values(folders)) {
    if (!value || typeof value !== "object") continue;
    const entry = value as Record<string, unknown>;
    if (typeof entry.path !== "string") continue;
    const apps = entry.apps && typeof entry.apps === "object" ? entry.apps as Record<string, unknown> : {};
    libraries.push({
      path: entry.path.replaceAll("\\\\", "\\"),
      hasCs2: Object.prototype.hasOwnProperty.call(apps, APP_ID)
    });
  }

  if (libraries.length === 0) {
    const regex = /"path"\s+"([^"]+)"/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(vdf)) !== null) {
      const candidate = match[1]?.replaceAll("\\\\", "\\");
      if (candidate) libraries.push({ path: candidate, hasCs2: false });
    }
  }

  return libraries;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function exists(candidate: string): Promise<boolean> {
  try {
    await withTimeout(access(candidate), FS_PROBE_TIMEOUT_MS, `Checking ${candidate}`);
    return true;
  } catch {
    return false;
  }
}

async function readText(candidate: string): Promise<string | undefined> {
  try {
    return await withTimeout(readFile(candidate, "utf8"), FS_PROBE_TIMEOUT_MS, `Reading ${candidate}`);
  } catch {
    return undefined;
  }
}

async function queryRegistryValue(key: string, value: string): Promise<string | undefined> {
  if (process.platform !== "win32") return undefined;
  try {
    const { stdout } = await execFileAsync("reg.exe", ["query", key, "/v", value], {
      windowsHide: true,
      timeout: REGISTRY_TIMEOUT_MS
    });
    const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return stdout.match(new RegExp(`${escaped}\\s+REG_\\w+\\s+(.+)$`, "im"))?.[1]?.trim();
  } catch {
    return undefined;
  }
}

async function steamRootFromRegistry(): Promise<string | undefined> {
  const candidate = await queryRegistryValue("HKCU\\Software\\Valve\\Steam", "SteamPath");
  return candidate?.replaceAll("/", "\\");
}

async function cs2InstallFromRegistry(): Promise<string | undefined> {
  const keys = [
    "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Steam App 730",
    "HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Steam App 730",
    "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Steam App 730"
  ];
  for (const key of keys) {
    const install = await queryRegistryValue(key, "InstallLocation");
    if (install) return install.replaceAll("/", "\\");
  }
  return undefined;
}

function commonSteamRoots(): string[] {
  const roots = new Set<string>();
  const registryCandidates = [process.env["ProgramFiles(x86)"], process.env.ProgramFiles].filter(Boolean) as string[];
  for (const base of registryCandidates) roots.add(path.join(base, "Steam"));
  roots.add("C:\\Program Files (x86)\\Steam");
  roots.add("C:\\Program Files\\Steam");
  return [...roots];
}

export function normalizeManualCs2Path(manualPath: string): { installDir: string; cfgDir: string } {
  const normalized = path.resolve(manualPath.trim().replace(/^"|"$/g, ""));
  const base = path.basename(normalized).toLowerCase();
  const parent = path.basename(path.dirname(normalized)).toLowerCase();
  const grandParent = path.basename(path.dirname(path.dirname(normalized))).toLowerCase();

  if (base === "cfg" && parent === "csgo" && grandParent === "game") {
    return {
      installDir: path.dirname(path.dirname(path.dirname(normalized))),
      cfgDir: normalized
    };
  }

  if (base === "csgo" && parent === "game") {
    const installDir = path.dirname(path.dirname(normalized));
    return { installDir, cfgDir: path.join(normalized, "cfg") };
  }

  if (base === "game") {
    const installDir = path.dirname(normalized);
    return { installDir, cfgDir: path.join(normalized, "csgo", "cfg") };
  }

  return {
    installDir: normalized,
    cfgDir: path.join(normalized, "game", "csgo", "cfg")
  };
}

export async function locateCs2Install(manualPath?: string): Promise<Cs2Install> {
  if (manualPath) {
    const direct = await resolveManualInstall(manualPath);
    if (direct) return direct;
    throw new Error("The selected path is not a valid CS2 install. You can paste either the Counter-Strike Global Offensive install folder or its game\\csgo\\cfg folder.");
  }

  const registryInstall = await cs2InstallFromRegistry();
  if (registryInstall) {
    const direct = await resolveManualInstall(registryInstall);
    if (direct) return direct;
  }

  const registryRoot = await steamRootFromRegistry();
  const candidates = [registryRoot, ...commonSteamRoots()].filter(Boolean) as string[];

  for (const steamRoot of [...new Set(candidates)]) {
    if (!(await exists(steamRoot))) continue;
    const result = await findInSteamRoot(steamRoot);
    if (result) return result;
  }

  throw new Error("Could not find Counter-Strike 2 automatically. Use CS2 path override and paste either the Counter-Strike Global Offensive install folder or its game\\csgo\\cfg folder.");
}

async function resolveManualInstall(manualPath: string): Promise<Cs2Install | undefined> {
  const normalized = normalizeManualCs2Path(manualPath);
  if (!(await exists(normalized.cfgDir))) return undefined;
  return {
    steamRoot: "manual",
    libraryRoot: "manual",
    installDir: normalized.installDir,
    cfgDir: normalized.cfgDir
  };
}

async function findInSteamRoot(steamRoot: string): Promise<Cs2Install | undefined> {
  const libraryFile = path.join(steamRoot, "steamapps", "libraryfolders.vdf");
  const vdf = await readText(libraryFile);
  const parsed = vdf ? parseSteamLibraries(vdf) : [];
  const prioritized = parsed.filter((library) => library.hasCs2);
  const fallback = parsed.filter((library) => !library.hasCs2);
  const libraryRoots = [
    ...prioritized.map((library) => library.path),
    steamRoot,
    ...(prioritized.length === 0 ? fallback.map((library) => library.path) : [])
  ];

  for (const libraryRoot of [...new Set(libraryRoots)]) {
    const appManifest = path.join(libraryRoot, "steamapps", `appmanifest_${APP_ID}.acf`);
    if (!(await exists(appManifest))) continue;

    const acf = await readText(appManifest);
    if (!acf) continue;
    const installFolder = parseInstallDir(acf);
    if (!installFolder) continue;
    const installDir = path.join(libraryRoot, "steamapps", "common", installFolder);
    const cfgDir = path.join(installDir, "game", "csgo", "cfg");
    if (!(await exists(cfgDir))) continue;
    return { steamRoot, libraryRoot, installDir, cfgDir };
  }

  return undefined;
}
