import streamDeck from "@elgato/streamdeck";

import {
  ClaudeStatusAction,
  NextPromptAction,
  QueueControlAction,
  QueuePromptAction
} from "./actions.js";
import { runtime } from "./runtime.js";

streamDeck.logger.setLevel("info");

streamDeck.actions.registerAction(new ClaudeStatusAction());
streamDeck.actions.registerAction(new QueuePromptAction());
streamDeck.actions.registerAction(new NextPromptAction());
streamDeck.actions.registerAction(new QueueControlAction());

function propertyInspectorSessions() {
  const snapshot = runtime.service.getSnapshot();
  return {
    type: "sessions",
    activeSessionId: snapshot.activeSessionId,
    sessions: snapshot.sessions.map((session) => ({
      id: session.id,
      label: session.humanLabel,
      projectLabel: session.projectLabel,
      shortId: session.shortId,
      lastUserPromptPreview: session.lastUserPromptPreview,
      cwd: session.cwd,
      state: session.state,
      waitingFor: session.waitingFor,
      queueCount: session.queue.length
    }))
  };
}

async function sendPropertyInspectorSessions(): Promise<void> {
  try {
    await streamDeck.ui.sendToPropertyInspector(propertyInspectorSessions());
  } catch {
    // No property inspector is currently visible.
  }
}

streamDeck.ui.onDidAppear(() => sendPropertyInspectorSessions());
streamDeck.ui.onSendToPlugin((ev) => {
  const payload = ev.payload as { type?: string } | undefined;
  if (payload?.type === "get-sessions") return sendPropertyInspectorSessions();
});
runtime.service.subscribe(() => void sendPropertyInspectorSessions());

streamDeck.connect().then(async () => {
  try {
    await runtime.start();
    streamDeck.logger.info("Claude Auto Queue runtime started on 127.0.0.1:19741");
    await sendPropertyInspectorSessions();
  } catch (error) {
    streamDeck.logger.error("Claude Auto Queue failed to start", error);
  }
});
