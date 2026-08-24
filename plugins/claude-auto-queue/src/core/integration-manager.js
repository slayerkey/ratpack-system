import { access, copyFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export const HOOK_EVENTS = [
  "UserPromptSubmit",
  "Stop",
  "PermissionRequest",
  "PermissionDenied",
  "PostToolUse",
  "PostToolUseFailure",
  "Notification",
  "StopFailure",
  "TaskCreated",
  "TaskCompleted"
];

export const HOOK_URL = "http://127.0.0.1:19741/hook";
export const HOOK_HEADER = "X-PackRat-Claude-Auto-Queue";

function defaultSettingsPath() {
  return path.join(os.homedir(), ".claude", "settings.json");
}

function ourHandler() {
  return {
    type: "http",
    url: HOOK_URL,
    timeout: 2,
    headers: {
      [HOOK_HEADER]: "1"
    }
  };
}

function isOurHandler(handler) {
  return (
    handler &&
    handler.type === "http" &&
    handler.url === HOOK_URL &&
    handler.headers?.[HOOK_HEADER] === "1"
  );
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function addPackRatHooks(settings) {
  const next = clone(settings && typeof settings === "object" ? settings : {});
  next.hooks = next.hooks && typeof next.hooks === "object" ? next.hooks : {};

  for (const event of HOOK_EVENTS) {
    const groups = Array.isArray(next.hooks[event]) ? next.hooks[event] : [];
    const alreadyInstalled = groups.some(
      (group) => Array.isArray(group?.hooks) && group.hooks.some(isOurHandler)
    );
    if (!alreadyInstalled) {
      groups.push({ hooks: [ourHandler()] });
    }
    next.hooks[event] = groups;
  }
  return next;
}

export function removePackRatHooks(settings) {
  const next = clone(settings && typeof settings === "object" ? settings : {});
  if (!next.hooks || typeof next.hooks !== "object") return next;

  for (const [event, groups] of Object.entries(next.hooks)) {
    if (!Array.isArray(groups)) continue;
    const cleaned = groups
      .map((group) => {
        if (!Array.isArray(group?.hooks)) return group;
        return { ...group, hooks: group.hooks.filter((handler) => !isOurHandler(handler)) };
      })
      .filter((group) => !Array.isArray(group?.hooks) || group.hooks.length > 0);
    if (cleaned.length > 0) next.hooks[event] = cleaned;
    else delete next.hooks[event];
  }

  if (Object.keys(next.hooks).length === 0) delete next.hooks;
  return next;
}

export function hasPackRatHooks(settings) {
  if (!settings?.hooks || typeof settings.hooks !== "object") return false;
  return HOOK_EVENTS.every((event) =>
    Array.isArray(settings.hooks[event]) &&
    settings.hooks[event].some(
      (group) => Array.isArray(group?.hooks) && group.hooks.some(isOurHandler)
    )
  );
}

export class IntegrationManager {
  constructor(settingsPath = defaultSettingsPath()) {
    this.settingsPath = settingsPath;
    this.backupPath = `${settingsPath}.packrat-auto-queue.backup.json`;
  }

  async readSettings() {
    try {
      const raw = await readFile(this.settingsPath, "utf8");
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (error) {
      if (error?.code === "ENOENT") return {};
      throw error;
    }
  }

  async writeSettings(settings) {
    await mkdir(path.dirname(this.settingsPath), { recursive: true });
    const temp = `${this.settingsPath}.packrat-${process.pid}-${Date.now()}.tmp`;
    await writeFile(temp, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
    await rename(temp, this.settingsPath);
  }

  async backupOnce() {
    try {
      await access(this.backupPath);
      return false;
    } catch {
      // Continue and create the first-recovery backup.
    }

    try {
      await access(this.settingsPath);
      await copyFile(this.settingsPath, this.backupPath);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      await mkdir(path.dirname(this.backupPath), { recursive: true });
      await writeFile(this.backupPath, "{}\n", "utf8");
    }
    return true;
  }

  async status() {
    try {
      const settings = await this.readSettings();
      return {
        ok: true,
        connected: hasPackRatHooks(settings),
        settingsPath: this.settingsPath,
        backupPath: this.backupPath
      };
    } catch (error) {
      return {
        ok: false,
        connected: false,
        settingsPath: this.settingsPath,
        backupPath: this.backupPath,
        error: String(error?.message ?? error)
      };
    }
  }

  async connect() {
    const settings = await this.readSettings();
    await this.backupOnce();
    const next = addPackRatHooks(settings);
    await this.writeSettings(next);
    return this.status();
  }

  async disconnect() {
    const settings = await this.readSettings();
    const next = removePackRatHooks(settings);
    await this.writeSettings(next);
    return this.status();
  }
}
