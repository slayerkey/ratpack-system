import {
  action,
  type DidReceiveSettingsEvent,
  type KeyAction,
  type KeyDownEvent,
  SingletonAction,
  type WillAppearEvent
} from "@elgato/streamdeck";

import { runtime } from "./runtime.js";
import {
  keyImage,
  renderControl,
  renderNext,
  renderQueuePrompt,
  renderStatus
} from "./renderer.js";

type QueueSettings = {
  prompt?: string;
  label?: string;
  sessionId?: string;
  operation?: "remove-next" | "clear" | "rotate";
};

async function paintStatusKey(key: KeyAction<QueueSettings>, settings: QueueSettings) {
  const session = runtime.service.getDisplaySession(settings?.sessionId ?? null);
  const label = runtime.service.getProjectLabel(session);
  await key.setImage(keyImage(renderStatus(session, label)));
}

@action({ UUID: "com.packrat.claude-auto-queue.status" })
export class ClaudeStatusAction extends SingletonAction<QueueSettings> {
  constructor() {
    super();
    runtime.service.subscribe(() => void this.paintAll());
    setInterval(() => void this.paintAll(), 1000).unref();
  }

  override async onWillAppear(ev: WillAppearEvent<QueueSettings>): Promise<void> {
    if (ev.action.isKey()) await paintStatusKey(ev.action, ev.payload.settings ?? {});
  }

  override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<QueueSettings>): Promise<void> {
    if (ev.action.isKey()) await paintStatusKey(ev.action, ev.payload.settings ?? {});
  }

  override async onKeyDown(ev: KeyDownEvent<QueueSettings>): Promise<void> {
    await paintStatusKey(ev.action, ev.payload.settings ?? {});
  }

  private async paintAll(): Promise<void> {
    for (const instance of this.actions) {
      if (!instance.isKey()) continue;
      await paintStatusKey(instance, await instance.getSettings<QueueSettings>());
    }
  }
}

@action({ UUID: "com.packrat.claude-auto-queue.queue-prompt" })
export class QueuePromptAction extends SingletonAction<QueueSettings> {
  override async onWillAppear(ev: WillAppearEvent<QueueSettings>): Promise<void> {
    if (!ev.action.isKey()) return;
    const settings = ev.payload.settings ?? {};
    await ev.action.setImage(
      keyImage(renderQueuePrompt(settings.label || "QUEUE PROMPT"))
    );
  }

  override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<QueueSettings>): Promise<void> {
    if (!ev.action.isKey()) return;
    const settings = ev.payload.settings ?? {};
    await ev.action.setImage(
      keyImage(renderQueuePrompt(settings.label || "QUEUE PROMPT"))
    );
  }

  override async onKeyDown(ev: KeyDownEvent<QueueSettings>): Promise<void> {
    const settings = ev.payload.settings ?? {};
    const prompt = settings.prompt?.trim() || "Continue with the next logical implementation step.";
    try {
      const item = await runtime.service.enqueue(prompt, settings.sessionId ?? null);
      await ev.action.setImage(
        keyImage(
          renderQueuePrompt(settings.label || "QUEUE PROMPT", {
            ok: true,
            text: `QUEUED #${item.position}`
          })
        )
      );
      await ev.action.showOk();
    } catch (error) {
      await ev.action.setImage(
        keyImage(
          renderQueuePrompt(settings.label || "QUEUE PROMPT", {
            ok: false,
            text: "SELECT SESSION"
          })
        )
      );
      await ev.action.showAlert();
    }

    setTimeout(async () => {
      try {
        await ev.action.setImage(
          keyImage(renderQueuePrompt(settings.label || "QUEUE PROMPT"))
        );
      } catch {
        // Key may have disappeared.
      }
    }, 1200).unref();
  }
}

@action({ UUID: "com.packrat.claude-auto-queue.next-prompt" })
export class NextPromptAction extends SingletonAction<QueueSettings> {
  constructor() {
    super();
    runtime.service.subscribe(() => void this.paintAll());
  }

  override async onWillAppear(ev: WillAppearEvent<QueueSettings>): Promise<void> {
    if (ev.action.isKey()) await this.paint(ev.action, ev.payload.settings ?? {});
  }

  override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<QueueSettings>): Promise<void> {
    if (ev.action.isKey()) await this.paint(ev.action, ev.payload.settings ?? {});
  }

  private async paintAll(): Promise<void> {
    for (const instance of this.actions) {
      if (!instance.isKey()) continue;
      await this.paint(instance, await instance.getSettings<QueueSettings>());
    }
  }

  private async paint(key: KeyAction<QueueSettings>, settings: QueueSettings): Promise<void> {
    const session = runtime.service.getDisplaySession(settings.sessionId ?? null);
    await key.setImage(keyImage(renderNext(session)));
  }
}

@action({ UUID: "com.packrat.claude-auto-queue.queue-control" })
export class QueueControlAction extends SingletonAction<QueueSettings> {
  override async onWillAppear(ev: WillAppearEvent<QueueSettings>): Promise<void> {
    if (!ev.action.isKey()) return;
    const operation = ev.payload.settings?.operation ?? "remove-next";
    await ev.action.setImage(keyImage(renderControl(operation)));
  }

  override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<QueueSettings>): Promise<void> {
    if (!ev.action.isKey()) return;
    const operation = ev.payload.settings?.operation ?? "remove-next";
    await ev.action.setImage(keyImage(renderControl(operation)));
  }

  override async onKeyDown(ev: KeyDownEvent<QueueSettings>): Promise<void> {
    const settings = ev.payload.settings ?? {};
    const operation = settings.operation ?? "remove-next";
    try {
      if (operation === "clear") await runtime.service.clearQueue(settings.sessionId ?? null);
      else if (operation === "rotate") await runtime.service.moveNextToEnd(settings.sessionId ?? null);
      else await runtime.service.removeNext(settings.sessionId ?? null);
      await ev.action.showOk();
    } catch {
      await ev.action.showAlert();
    }
  }
}
