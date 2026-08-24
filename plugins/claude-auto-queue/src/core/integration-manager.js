import { randomBytes, timingSafeEqual } from "node:crypto";
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
const TOKEN_PREFIX = "v1:";

function defaultSettingsPath() {
  return path.join(os.homedir(), ".claude", "settings.json");
}

export function generateHookToken() {
  return `${TOKEN_PREFIX}${randomBytes(32).toString("hex")}`;
}

function ourHandler(token) {
  return {
    type: "http",
    url: HOOK_URL,
    timeout: 2,
    headers: {
      [HOOK_HEADER]: token
    }
  };
}

function isOurHandler(handler) {
  return (
    handler &&
    handler.type === "http" &&
    handler.url === HOOK_URL &&
    typeof handler.headers?.[HOOK_HEADER] === "string"
  );
}

function handlerToken(handler) {
  return isOurHandler(handler) ? handler.headers[HOOK_HEADER] : null;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function getPackRatHookToken(settings) {
  if (!settings?.hooks || typeof settings.hooks !== "object") return null;
  let token = null;
  for (const event of HOOK_EVENTS) {
    const groups = settings.hooks[event];
    if (!Array.isArray(groups)) return null;
    const eventTokens = groups
      .flatMap((group) => (Array.isArray(group?.hooks) ? group.hooks : []))
      .map(handlerToken)
      .filter(Boolean);
    if (eventTokens.length === 0) return null;
    const current = eventTokens[0];
    if (token === null) token = current;
    if (current !== token || eventTokens.some((candidate) => candidate !== token)) return null;
  }
  return token;
}

export function addPackRatHooks(settings, token = generateHookToken()) {
  const next = removePackRatHooks(settings);
  next.hooks = next.hooks && typeof next.hooks === "object" ? next.hooks : {};

  for (const event of HOOK_EVENTS) {
    const groups = Array.isArray(next.hooks[event]) ? next.hooks[event] : [];
    groups.push({ hooks: [ourHandler(token)] });
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
  return Boolean(getPackRatHookToken(settings));
}

function secureTokenEqual(expected, received) {
  if (typeof expected !== "string" || typeof received !== "string") return false;
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(received, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export class IntegrationManager {
  constructor(settingsPath = defaultSettingsPath()) {
    this.settingsPath = settingsPath;
    this.backupPath = `${settingsPath}.packrat-auto-queue.backup.json`;
    this.hookToken = null;
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

  async initialize() {
    try {
      const settings = await this.readSettings();
      this.hookToken = getPackRatHookToken(settings);
    } catch {
      this.hookToken = null;
    }
  }

  authorizeHookHeader(value) {
    return secureTokenEqual(this.hookToken, value);
  }

  async status() {
    try {
      const settings = await this.readSettings();
      const token = getPackRatHookToken(settings);
      this.hookToken = token;
      return {
        ok: true,
        connected: Boolean(token),
        secureHookAuth: Boolean(token?.startsWith(TOKEN_PREFIX)),
        needsReconnect: Boolean(token && !token.startsWith(TOKEN_PREFIX)),
        settingsPath: this.settingsPath,
        backupPath: this.backupPath
      };
    } catch (error) {
      this.hookToken = null;
      return {
        ok: false,
        connected: false,
        secureHookAuth: false,
        needsReconnect: false,
        settingsPath: this.settingsPath,
        backupPath: this.backupPath,
        error: String(error?.message ?? error)
      };
    }
  }

  async connect() {
    const settings = await this.readSettings();
    await this.backupOnce();
    const token = generateHookToken();
    const next = addPackRatHooks(settings, token);
    await this.writeSettings(next);
    this.hookToken = token;
    return this.status();
  }

  async disconnect() {
    const settings = await this.readSettings();
    const next = removePackRatHooks(settings);
    await this.writeSettings(next);
    this.hookToken = null;
    return this.status();
  }
}
