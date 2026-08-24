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

streamDeck.connect().then(async () => {
  try {
    await runtime.start();
    streamDeck.logger.info("Claude Auto Queue runtime started on 127.0.0.1:19741");
  } catch (error) {
    streamDeck.logger.error("Claude Auto Queue failed to start", error);
  }
});
