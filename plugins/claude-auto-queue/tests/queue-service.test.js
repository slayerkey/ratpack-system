import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  AutoQueueService,
  MAX_AUTOMATIC_CONTINUATIONS,
  MAX_QUEUE_PROMPT_CHARS,
  MAX_SESSION_PROMPT_PREVIEW_CHARS,
  makeSessionPromptPreview
} from "../src/core/queue-service.js";
import { StateStore } from "../src/core/state-store.js";

async function makeService() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "claude-auto-queue-"));
  let now = 1000;
  const service = new AutoQueueService({
    store: new StateStore(path.join(dir, "state.json")),
    clock: () => ++now
  });
  await service.initialize();
  return service;
}

async function startSession(service, id = "session-a", prompt = "Build it") {
  await service.handleHook({
    hook_event_name: "UserPromptSubmit",
    session_id: id,
    cwd: "/work/project",
    prompt
  });
}

test("queues a prompt and injects factual user-authored context at the next Stop boundary", async () => {
  const service = await makeService();
  await startSession(service);
  await service.enqueue("Run tests and fix failures");

  const response = await service.handleHook({
    hook_event_name: "Stop",
    session_id: "session-a",
    cwd: "/work/project",
    stop_hook_active: false,
    background_tasks: [],
    session_crons: []
  });

  assert.equal(response.hookSpecificOutput.hookEventName, "Stop");
  assert.match(response.hookSpecificOutput.additionalContext, /user authored the following as the next queued request/i);
  assert.match(response.hookSpecificOutput.additionalContext, /Run tests and fix failures/);
  assert.doesNotMatch(response.hookSpecificOutput.additionalContext, /system command/i);
  const session = service.getSession("session-a");
  assert.equal(session.queue.length, 0);
  assert.equal(session.state, "working");
  assert.equal(session.continuationCount, 1);
});

test("captures a short human-readable preview of the last real user prompt", async () => {
  const service = await makeService();
  const longPrompt = `Please inspect the current project\n\n${"and explain the architecture in detail ".repeat(5)}`;
  await startSession(service, "session-preview", longPrompt);

  const session = service.getSession("session-preview");
  assert.equal(session.lastUserPromptPreview, makeSessionPromptPreview(longPrompt));
  assert.equal(session.humanLabel, session.lastUserPromptPreview);
  assert.equal(session.projectLabel, "project");
  assert.equal(session.shortId, "session-");
  assert.ok(session.lastUserPromptPreview.length <= MAX_SESSION_PROMPT_PREVIEW_CHARS);
  assert.doesNotMatch(session.lastUserPromptPreview, /\n/);
  assert.ok(longPrompt.length > session.lastUserPromptPreview.length);
});

test("rejects queued prompts that would approach Claude's 10k additionalContext spill threshold", async () => {
  const service = await makeService();
  await startSession(service);
  assert.equal(MAX_QUEUE_PROMPT_CHARS, 9000);
  await service.enqueue("x".repeat(MAX_QUEUE_PROMPT_CHARS));
  await assert.rejects(
    () => service.enqueue("x".repeat(MAX_QUEUE_PROMPT_CHARS + 1)),
    /Maximum is 9,000 characters/
  );
});

test("does not drain the queue while Claude has background work that can wake the session", async () => {
  const service = await makeService();
  await startSession(service);
  await service.enqueue("Review the implementation");

  const response = await service.handleHook({
    hook_event_name: "Stop",
    session_id: "session-a",
    stop_hook_active: false,
    background_tasks: [{ id: "task-1", type: "shell", status: "running" }],
    session_crons: []
  });

  assert.equal(response, null);
  assert.equal(service.getSession("session-a").queue.length, 1);
  assert.equal(service.getSession("session-a").state, "working");
});

test("caps automatic continuation at six and leaves later work queued", async () => {
  const service = await makeService();
  await startSession(service);

  for (let i = 1; i <= MAX_AUTOMATIC_CONTINUATIONS + 1; i++) {
    await service.enqueue(`Job ${i}`);
  }

  for (let i = 1; i <= MAX_AUTOMATIC_CONTINUATIONS; i++) {
    const response = await service.handleHook({
      hook_event_name: "Stop",
      session_id: "session-a",
      stop_hook_active: i > 1,
      background_tasks: [],
      session_crons: []
    });
    assert.match(response.hookSpecificOutput.additionalContext, new RegExp(`Job ${i}`));
  }

  const seventh = await service.handleHook({
    hook_event_name: "Stop",
    session_id: "session-a",
    stop_hook_active: true,
    background_tasks: [],
    session_crons: []
  });

  assert.equal(seventh, null);
  const session = service.getSession("session-a");
  assert.equal(session.queue.length, 1);
  assert.equal(session.queue[0].prompt, "Job 7");
  assert.equal(session.queueLimitReached, true);
  assert.equal(session.state, "need_you");
  assert.equal(session.waitingFor, "queue safety limit");
});

test("a fresh user turn resets the automatic continuation safety counter", async () => {
  const service = await makeService();
  await startSession(service);
  const session = service.getOrCreateSession("session-a");
  session.continuationCount = 6;
  session.queueLimitReached = true;

  await service.handleHook({
    hook_event_name: "UserPromptSubmit",
    session_id: "session-a",
    cwd: "/work/project",
    prompt: "New manual prompt"
  });

  assert.equal(service.getSession("session-a").continuationCount, 0);
  assert.equal(service.getSession("session-a").queueLimitReached, false);
  assert.equal(service.getSession("session-a").lastUserPromptPreview, "New manual prompt");
});

test("permission and API failure states are explicit", async () => {
  const service = await makeService();
  await startSession(service);

  await service.handleHook({
    hook_event_name: "PermissionRequest",
    session_id: "session-a",
    tool_name: "Bash"
  });
  assert.equal(service.getSession("session-a").state, "need_you");
  assert.equal(service.getSession("session-a").waitingFor, "permission: Bash");

  await service.handleHook({
    hook_event_name: "PostToolUse",
    session_id: "session-a",
    tool_name: "Bash"
  });
  assert.equal(service.getSession("session-a").state, "working");

  await service.handleHook({
    hook_event_name: "StopFailure",
    session_id: "session-a",
    error: "rate_limit"
  });
  assert.equal(service.getSession("session-a").state, "error");
  assert.equal(service.getSession("session-a").lastError, "rate_limit");
});

test("Auto uses the only working session when no hook-learned active session exists yet", async () => {
  const service = await makeService();
  await service.reconcileAgents([
    { sessionId: "a", cwd: "/a", kind: "interactive", state: "working" },
    { sessionId: "b", cwd: "/b", kind: "interactive", state: "idle" }
  ]);
  service.activeSessionId = null;

  assert.equal(service.resolveTarget(), "a");
});

test("never guesses when multiple sessions exist and no active session is known", async () => {
  const service = await makeService();
  await service.reconcileAgents([
    { sessionId: "a", cwd: "/a", kind: "interactive" },
    { sessionId: "b", cwd: "/b", kind: "interactive" }
  ]);
  service.activeSessionId = null;

  assert.throws(
    () => service.resolveTarget(),
    /Multiple Claude sessions/
  );
});

test("an explicit session binding routes queued work only to that session", async () => {
  const service = await makeService();
  await service.reconcileAgents([
    { sessionId: "a", cwd: "/a", kind: "interactive" },
    { sessionId: "b", cwd: "/b", kind: "interactive" }
  ]);
  service.activeSessionId = null;

  const queued = await service.enqueue("Only session B should receive this", "b");
  assert.equal(queued.sessionId, "b");
  assert.equal(service.getSession("a").queue.length, 0);
  assert.equal(service.getSession("b").queue.length, 1);

  const wrongStop = await service.handleHook({
    hook_event_name: "Stop",
    session_id: "a",
    stop_hook_active: false,
    background_tasks: [],
    session_crons: []
  });
  assert.equal(wrongStop, null);
  assert.equal(service.getSession("b").queue.length, 1);

  const rightStop = await service.handleHook({
    hook_event_name: "Stop",
    session_id: "b",
    stop_hook_active: false,
    background_tasks: [],
    session_crons: []
  });
  assert.match(rightStop.hookSpecificOutput.additionalContext, /Only session B/);
  assert.equal(service.getSession("b").queue.length, 0);
});

test("queue and human prompt preview survive a service restart", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "claude-auto-queue-persist-"));
  const file = path.join(dir, "state.json");
  const first = new AutoQueueService({ store: new StateStore(file) });
  await first.initialize();
  await startSession(first, "persisted", "Please document the implementation choices");
  await first.enqueue("Document the implementation");

  const second = new AutoQueueService({ store: new StateStore(file) });
  await second.initialize();
  assert.equal(second.getSession("persisted").queue[0].prompt, "Document the implementation");
  assert.equal(second.getSession("persisted").lastUserPromptPreview, "Please document the implementation choices");
});
