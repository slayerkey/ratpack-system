import { randomUUID } from "node:crypto";
import path from "node:path";
import { StateStore } from "./state-store.js";

export const MAX_AUTOMATIC_CONTINUATIONS = 6;

const ATTENTION_NOTIFICATIONS = new Set([
  "permission_prompt",
  "idle_prompt",
  "elicitation_dialog",
  "elicitation_url_dialog",
  "agent_needs_input"
]);

function nowMs() {
  return Date.now();
}

function cleanPrompt(value) {
  const prompt = String(value ?? "").trim();
  if (!prompt) throw new Error("Prompt cannot be empty.");
  if (prompt.length > 10000) throw new Error("Prompt is too long. Maximum is 10,000 characters.");
  return prompt;
}

function emptySession(id) {
  return {
    id,
    name: null,
    cwd: null,
    kind: null,
    state: "idle",
    waitingFor: null,
    turnStartedAt: null,
    lastEventAt: null,
    lastError: null,
    currentTask: null,
    continuationCount: 0,
    queueLimitReached: false,
    queue: []
  };
}

export class AutoQueueService {
  constructor({ store = new StateStore(), clock = nowMs } = {}) {
    this.store = store;
    this.clock = clock;
    this.sessions = new Map();
    this.activeSessionId = null;
    this.listeners = new Set();
    this.initialized = false;
    this.saveChain = Promise.resolve();
  }

  async initialize() {
    if (this.initialized) return;
    const saved = await this.store.load();
    if (saved?.sessions && typeof saved.sessions === "object") {
      for (const [id, data] of Object.entries(saved.sessions)) {
        const session = emptySession(id);
        session.name = data?.name ?? null;
        session.cwd = data?.cwd ?? null;
        session.kind = data?.kind ?? null;
        session.continuationCount = Number.isFinite(data?.continuationCount)
          ? Math.max(0, Math.floor(data.continuationCount))
          : 0;
        session.queueLimitReached = Boolean(data?.queueLimitReached);
        session.queue = Array.isArray(data?.queue)
          ? data.queue
              .filter((item) => item && typeof item.prompt === "string")
              .map((item) => ({
                id: typeof item.id === "string" ? item.id : randomUUID(),
                prompt: item.prompt,
                addedAt: Number.isFinite(item.addedAt) ? item.addedAt : this.clock()
              }))
          : [];
        this.sessions.set(id, session);
      }
    }
    this.activeSessionId =
      typeof saved?.activeSessionId === "string" && this.sessions.has(saved.activeSessionId)
        ? saved.activeSessionId
        : null;
    this.initialized = true;
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit() {
    for (const listener of this.listeners) {
      try {
        listener(this.getSnapshot());
      } catch {
        // A renderer must never be able to break the queue service.
      }
    }
  }

  getOrCreateSession(id) {
    let session = this.sessions.get(id);
    if (!session) {
      session = emptySession(id);
      this.sessions.set(id, session);
    }
    return session;
  }

  async persist() {
    const snapshot = {
      version: 1,
      activeSessionId: this.activeSessionId,
      sessions: Object.fromEntries(
        [...this.sessions.entries()].map(([id, session]) => [
          id,
          {
            name: session.name,
            cwd: session.cwd,
            kind: session.kind,
            continuationCount: session.continuationCount,
            queueLimitReached: session.queueLimitReached,
            queue: session.queue
          }
        ])
      )
    };
    this.saveChain = this.saveChain.then(() => this.store.save(snapshot));
    return this.saveChain;
  }

  getSnapshot() {
    const sessions = [...this.sessions.values()]
      .map((session) => ({
        ...session,
        queue: session.queue.map((item) => ({ ...item }))
      }))
      .sort((a, b) => (b.lastEventAt ?? 0) - (a.lastEventAt ?? 0));
    return {
      activeSessionId: this.activeSessionId,
      sessions
    };
  }

  getSession(id) {
    const session = this.sessions.get(id);
    return session ? { ...session, queue: session.queue.map((item) => ({ ...item })) } : null;
  }

  resolveTarget(explicitSessionId = null) {
    if (explicitSessionId) {
      if (!this.sessions.has(explicitSessionId)) {
        throw new Error("The selected Claude session is no longer available.");
      }
      return explicitSessionId;
    }

    if (this.activeSessionId && this.sessions.has(this.activeSessionId)) {
      return this.activeSessionId;
    }

    const candidates = [...this.sessions.values()].filter(
      (session) => session.state !== "finished" && session.state !== "error"
    );
    if (candidates.length === 1) return candidates[0].id;

    if (this.sessions.size === 1) return [...this.sessions.keys()][0];
    if (this.sessions.size === 0) throw new Error("No Claude Code session detected.");
    throw new Error("Multiple Claude sessions are available. Select a session before queueing.");
  }

  async enqueue(prompt, explicitSessionId = null) {
    await this.initialize();
    const targetId = this.resolveTarget(explicitSessionId);
    const session = this.getOrCreateSession(targetId);
    const item = {
      id: randomUUID(),
      prompt: cleanPrompt(prompt),
      addedAt: this.clock()
    };
    session.queue.push(item);
    await this.persist();
    this.emit();
    return { ...item, position: session.queue.length, sessionId: targetId };
  }

  async removeNext(explicitSessionId = null) {
    await this.initialize();
    const targetId = this.resolveTarget(explicitSessionId);
    const session = this.getOrCreateSession(targetId);
    const removed = session.queue.shift() ?? null;
    await this.persist();
    this.emit();
    return removed;
  }

  async clearQueue(explicitSessionId = null) {
    await this.initialize();
    const targetId = this.resolveTarget(explicitSessionId);
    const session = this.getOrCreateSession(targetId);
    const count = session.queue.length;
    session.queue = [];
    session.queueLimitReached = false;
    await this.persist();
    this.emit();
    return count;
  }

  async moveNextToEnd(explicitSessionId = null) {
    await this.initialize();
    const targetId = this.resolveTarget(explicitSessionId);
    const session = this.getOrCreateSession(targetId);
    if (session.queue.length <= 1) return false;
    session.queue.push(session.queue.shift());
    await this.persist();
    this.emit();
    return true;
  }

  async reconcileAgents(agentRows) {
    await this.initialize();
    if (!Array.isArray(agentRows)) return;
    let changed = false;
    for (const row of agentRows) {
      const id = typeof row?.sessionId === "string" ? row.sessionId : null;
      if (!id) continue;
      const session = this.getOrCreateSession(id);
      session.name = typeof row.name === "string" ? row.name : session.name;
      session.cwd = typeof row.cwd === "string" ? row.cwd : session.cwd;
      session.kind = typeof row.kind === "string" ? row.kind : session.kind;

      const waitingFor = typeof row.waitingFor === "string" ? row.waitingFor : null;
      if (waitingFor) {
        session.waitingFor = waitingFor;
        session.state = "need_you";
      } else if (row.state === "working" || row.status === "working") {
        session.waitingFor = null;
        session.state = "working";
      } else if (row.state === "failed") {
        session.state = "error";
      }
      changed = true;
    }
    if (changed) this.emit();
  }

  async handleHook(payload) {
    await this.initialize();
    const event = String(payload?.hook_event_name ?? "");
    const id = typeof payload?.session_id === "string" ? payload.session_id : null;
    if (!event || !id) return null;

    const session = this.getOrCreateSession(id);
    session.cwd = typeof payload.cwd === "string" ? payload.cwd : session.cwd;
    session.lastEventAt = this.clock();
    this.activeSessionId = id;

    switch (event) {
      case "UserPromptSubmit":
        session.state = "working";
        session.waitingFor = null;
        session.turnStartedAt = this.clock();
        session.lastError = null;
        session.continuationCount = 0;
        session.queueLimitReached = false;
        break;

      case "PermissionRequest":
        session.state = "need_you";
        session.waitingFor = payload.tool_name
          ? `permission: ${String(payload.tool_name)}`
          : "permission prompt";
        break;

      case "Notification": {
        const type = String(payload.notification_type ?? "");
        if (ATTENTION_NOTIFICATIONS.has(type)) {
          session.state = "need_you";
          session.waitingFor = type.replaceAll("_", " ");
        } else if (type === "agent_completed" && session.state !== "working") {
          session.state = "finished";
        }
        break;
      }

      case "PostToolUse":
      case "PostToolUseFailure":
      case "PermissionDenied":
        if (session.state === "need_you") {
          session.state = "working";
          session.waitingFor = null;
        }
        break;

      case "TaskCreated":
        session.currentTask =
          typeof payload.task_subject === "string" ? payload.task_subject : session.currentTask;
        break;

      case "TaskCompleted":
        if (
          typeof payload.task_subject === "string" &&
          session.currentTask === payload.task_subject
        ) {
          session.currentTask = null;
        }
        break;

      case "StopFailure":
        session.state = "error";
        session.waitingFor = null;
        session.lastError = String(payload.error ?? "unknown");
        break;

      case "Stop": {
        session.waitingFor = null;
        session.lastError = null;

        const hasBackgroundWork =
          (Array.isArray(payload.background_tasks) && payload.background_tasks.length > 0) ||
          (Array.isArray(payload.session_crons) && payload.session_crons.length > 0);

        if (hasBackgroundWork) {
          session.state = "working";
          break;
        }

        if (!payload.stop_hook_active) {
          // This is a fresh user-driven turn boundary. It also repairs the counter if
          // Stream Deck restarted and missed UserPromptSubmit earlier in the turn.
          session.continuationCount = 0;
          session.queueLimitReached = false;
        }

        if (session.queue.length === 0) {
          session.state = "finished";
          session.turnStartedAt = null;
          break;
        }

        if (session.continuationCount >= MAX_AUTOMATIC_CONTINUATIONS) {
          session.state = "need_you";
          session.waitingFor = "queue safety limit";
          session.queueLimitReached = true;
          break;
        }

        const next = session.queue.shift();
        session.continuationCount += 1;
        session.state = "working";
        session.turnStartedAt = this.clock();
        await this.persist();
        this.emit();

        return {
          hookSpecificOutput: {
            hookEventName: "Stop",
            additionalContext:
              "The user queued the following follow-up task in PackRat Auto Queue. Continue this same session by doing it now:\n\n" +
              next.prompt
          }
        };
      }

      default:
        break;
    }

    await this.persist();
    this.emit();
    return null;
  }

  getDisplaySession(explicitSessionId = null) {
    if (explicitSessionId && this.sessions.has(explicitSessionId)) {
      return this.getSession(explicitSessionId);
    }
    if (this.activeSessionId && this.sessions.has(this.activeSessionId)) {
      return this.getSession(this.activeSessionId);
    }
    if (this.sessions.size === 1) return this.getSession([...this.sessions.keys()][0]);
    const ordered = [...this.sessions.values()].sort(
      (a, b) => (b.lastEventAt ?? 0) - (a.lastEventAt ?? 0)
    );
    return ordered[0] ? this.getSession(ordered[0].id) : null;
  }

  getProjectLabel(session) {
    if (!session) return "No session";
    if (session.name) return session.name;
    if (session.cwd) return path.basename(session.cwd);
    return "Claude Code";
  }
}
