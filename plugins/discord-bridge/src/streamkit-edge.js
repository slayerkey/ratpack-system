import { EventEmitter } from "node:events";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const DEFAULT_DEBUG_PORT = 17484;
const POLL_MS = 250;

function digits(value) {
  return String(value || "").trim().replace(/\D/g, "");
}

export function normalizeStreamKitConfig(input = {}) {
  const guildId = digits(input.guildId);
  const channelId = digits(input.channelId);
  const channelLabel = String(input.channelLabel || "").trim().slice(0, 64);
  if (!/^\d{5,24}$/.test(guildId)) throw new Error("Discord Server ID is required");
  if (!/^\d{5,24}$/.test(channelId)) throw new Error("Discord Voice Channel ID is required");
  return { guildId, channelId, channelLabel: channelLabel || "Discord Voice" };
}

export function buildStreamKitUrl(input) {
  const cfg = normalizeStreamKitConfig(input);
  const params = new URLSearchParams({
    icon: "true",
    online: "true",
    logo: "white",
    text_color: "#ffffff",
    text_size: "14",
    text_outline_color: "#000000",
    text_outline_size: "0",
    text_shadow_color: "#000000",
    text_shadow_size: "0",
    bg_color: "#090b10",
    bg_opacity: "0",
    bg_shadow_color: "#000000",
    bg_shadow_size: "0",
    invite_code: "",
    limit_speaking: "false",
    small_avatars: "false",
    hide_names: "false",
    fade_chat: "0",
    streamer_avatar_first: "true",
  });
  return `https://streamkit.discord.com/overlay/voice/${cfg.guildId}/${cfg.channelId}?${params.toString()}`;
}

export function normalizeDomSnapshot(raw = {}, config = {}) {
  const rows = Array.isArray(raw.rows) ? raw.rows : [];
  const members = rows.map((row, index) => {
    const avatarUrl = String(row?.avatarUrl || "");
    const srcId = avatarUrl.match(/(?:avatars|users)\/(\d{5,24})/i)?.[1] || avatarUrl.match(/(\d{15,24})/)?.[1];
    const name = String(row?.name || "").trim() || `Member ${index + 1}`;
    const id = String(row?.id || srcId || `streamkit-${index}-${name.toLowerCase().replace(/\s+/g, "-")}`);
    return {
      id,
      name,
      avatarUrl,
      speaking: Boolean(row?.speaking),
      mute: Boolean(row?.mute),
      deaf: Boolean(row?.deaf),
      self: index === 0,
      order: index,
    };
  });
  return {
    pageReady: Boolean(raw.pageReady),
    documentReady: String(raw.documentReady || ""),
    title: String(raw.title || ""),
    channel: {
      id: String(config.channelId || ""),
      guildId: String(config.guildId || ""),
      name: String(config.channelLabel || "Discord Voice"),
    },
    members,
    selfVoice: members[0] ? { mute: members[0].mute, deaf: members[0].deaf } : null,
  };
}

export const STREAMKIT_DOM_EXPRESSION = `(() => {
  const root = document.querySelector('[class*="Voice_voiceStates"]');
  const rows = Array.from(document.querySelectorAll('[class*="Voice_voiceState"]')).map((row, index) => {
    const avatar = row.querySelector('img[class*="Voice_avatar"]') || row.querySelector('img');
    const nameNode = row.querySelector('[class*="Voice_name"]');
    const avatarUrl = avatar ? (avatar.currentSrc || avatar.src || '') : '';
    const labels = Array.from(row.querySelectorAll('[aria-label],[title]')).map((node) => (node.getAttribute('aria-label') || node.getAttribute('title') || '')).join(' ');
    const stateText = (labels + ' ' + (row.innerText || '')).toLowerCase();
    const classText = avatar ? String(avatar.className || '') : '';
    const idMatch = avatarUrl.match(/(?:avatars|users)\\/(\\d{5,24})/i) || avatarUrl.match(/(\\d{15,24})/);
    return {
      id: idMatch ? idMatch[1] : '',
      name: nameNode ? String(nameNode.textContent || '').trim() : (avatar && avatar.alt ? String(avatar.alt).trim() : ''),
      avatarUrl,
      speaking: /speaking/i.test(classText) || /speaking/i.test(String(row.className || '')),
      mute: /(^|\\W)muted?(\\W|$)/i.test(stateText),
      deaf: /deaf/i.test(stateText),
      index
    };
  });
  return { pageReady: Boolean(root), documentReady: document.readyState, title: document.title, rows };
})()`;

function edgeCandidates(env = process.env) {
  return [
    env.PACKRAT_EDGE_PATH,
    env["PROGRAMFILES(X86)"] && join(env["PROGRAMFILES(X86)"], "Microsoft", "Edge", "Application", "msedge.exe"),
    env.PROGRAMFILES && join(env.PROGRAMFILES, "Microsoft", "Edge", "Application", "msedge.exe"),
    env.LOCALAPPDATA && join(env.LOCALAPPDATA, "Microsoft", "Edge", "Application", "msedge.exe"),
  ].filter(Boolean);
}

export function findEdgeExecutable(env = process.env) {
  return edgeCandidates(env).find((candidate) => existsSync(candidate)) || null;
}

class CdpClient {
  constructor(url) {
    this.url = url;
    this.socket = null;
    this.nextId = 1;
    this.pending = new Map();
  }

  async connect() {
    this.socket = new WebSocket(this.url);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Edge DevTools WebSocket timed out")), 5000);
      this.socket.addEventListener("open", () => {
        clearTimeout(timer);
        resolve();
      }, { once: true });
      this.socket.addEventListener("error", () => {
        clearTimeout(timer);
        reject(new Error("Edge DevTools WebSocket failed"));
      }, { once: true });
    });
    this.socket.addEventListener("message", (event) => {
      let message;
      try {
        message = JSON.parse(String(event.data));
      } catch {
        return;
      }
      if (!message.id || !this.pending.has(message.id)) return;
      const pending = this.pending.get(message.id);
      this.pending.delete(message.id);
      clearTimeout(pending.timer);
      if (message.error) pending.reject(new Error(message.error.message || "CDP error"));
      else pending.resolve(message.result || {});
    });
  }

  send(method, params = {}, timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
      if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
        reject(new Error("CDP socket is not open"));
        return;
      }
      const id = this.nextId++;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${method} timed out`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    try {
      this.socket?.close();
    } catch {
    }
  }
}

async function getJson(url, timeoutMs = 1000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

export class StreamKitEdge extends EventEmitter {
  constructor({ debugPort = DEFAULT_DEBUG_PORT, profileDir = null } = {}) {
    super();
    this.debugPort = debugPort;
    this.profileDir = profileDir || (process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, "PackRat", "discord-streamkit-profile") : null);
    this.config = null;
    this.edgeProcess = null;
    this.cdp = null;
    this.pollTimer = null;
    this.lastSignature = "";
    this.stage = "idle";
    this.lastError = null;
  }

  setStage(stage, error = null) {
    this.stage = stage;
    this.lastError = error ? String(error?.message || error) : null;
    this.emit("stage", { stage: this.stage, error: this.lastError });
  }

  async start(input) {
    this.config = normalizeStreamKitConfig(input);
    this.setStage("starting");
    const url = buildStreamKitUrl(this.config);
    try {
      let target = await this.findTarget().catch(() => null);
      if (!target) {
        const edge = findEdgeExecutable();
        if (!edge) throw new Error("Microsoft Edge was not found");
        const args = [
          "--headless=new",
          `--remote-debugging-port=${this.debugPort}`,
          "--no-first-run",
          "--no-default-browser-check",
          "--disable-features=TranslateUI",
          "--disable-renderer-backgrounding",
          "--disable-background-timer-throttling",
        ];
        if (this.profileDir) args.push(`--user-data-dir=${this.profileDir}`);
        args.push(url);
        this.edgeProcess = spawn(edge, args, { windowsHide: true, stdio: "ignore" });
        this.edgeProcess.once("exit", (code) => {
          if (this.stage !== "stopped") this.setStage("browser-exited", `Edge helper exited with code ${code}`);
        });
        target = await this.waitForTarget();
      }
      await this.attach(target);
      if (target.url !== url) await this.cdp.send("Page.navigate", { url }, 8000);
      this.setStage("loading");
      this.schedulePoll(100);
      return true;
    } catch (error) {
      this.setStage("failed", error);
      return false;
    }
  }

  async findTarget() {
    const list = await getJson(`http://127.0.0.1:${this.debugPort}/json/list`, 800);
    if (!Array.isArray(list)) return null;
    return list.find((entry) => entry.type === "page" && entry.webSocketDebuggerUrl) || null;
  }

  async waitForTarget(timeoutMs = 12000) {
    const until = Date.now() + timeoutMs;
    let last;
    while (Date.now() < until) {
      try {
        const target = await this.findTarget();
        if (target) return target;
      } catch (error) {
        last = error;
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    throw last || new Error("Edge DevTools endpoint did not become ready");
  }

  async attach(target) {
    this.cdp?.close();
    this.cdp = new CdpClient(target.webSocketDebuggerUrl);
    await this.cdp.connect();
    await this.cdp.send("Runtime.enable");
    await this.cdp.send("Page.enable");
  }

  schedulePoll(delay = POLL_MS) {
    clearTimeout(this.pollTimer);
    this.pollTimer = setTimeout(() => this.poll(), delay);
  }

  async poll() {
    if (!this.cdp || !this.config) return;
    try {
      const result = await this.cdp.send("Runtime.evaluate", {
        expression: STREAMKIT_DOM_EXPRESSION,
        returnByValue: true,
      }, 4000);
      const raw = result?.result?.value || {};
      const snapshot = normalizeDomSnapshot(raw, this.config);
      if (snapshot.pageReady && this.stage !== "ready") this.setStage("ready");
      const signature = JSON.stringify(snapshot);
      if (signature !== this.lastSignature) {
        this.lastSignature = signature;
        this.emit("snapshot", snapshot);
      }
      this.schedulePoll(POLL_MS);
    } catch (error) {
      this.setStage("retrying", error);
      try {
        const target = await this.waitForTarget(3000);
        await this.attach(target);
        this.schedulePoll(200);
      } catch (inner) {
        this.setStage("failed", inner);
      }
    }
  }

  async refresh() {
    if (!this.config) return false;
    if (!this.cdp) return this.start(this.config);
    try {
      await this.cdp.send("Page.reload", { ignoreCache: true }, 8000);
      this.setStage("loading");
      return true;
    } catch {
      return this.start(this.config);
    }
  }

  stop() {
    clearTimeout(this.pollTimer);
    this.pollTimer = null;
    this.cdp?.close();
    this.cdp = null;
    this.setStage("stopped");
  }
}
