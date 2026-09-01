import { SingletonAction } from "@elgato/streamdeck";
import { keyImageUpdateQueue } from "../render/key-update-queue.js";
import { renderKeySvg } from "../render/key-svg.js";
import type { DashboardRuntime } from "../runtime.js";
import { sessionDisplay } from "./format.js";

export type SessionSettings = { metric?: string };

const ALLOWED = ["record", "matches", "kd", "adr", "hs"] as const;

export class SessionMetricActionBase extends SingletonAction<SessionSettings> {
  private readonly visible = new Map<any, string>();

  constructor(private readonly runtime: DashboardRuntime) {
    super();
    this.runtime.subscribe(() => this.refreshAll());
  }

  override async onWillAppear(ev: any): Promise<void> {
    if (!ev.action.isKey()) return;
    const metric = this.metricFrom(ev.payload.settings);
    this.visible.set(ev.action, metric);
    if (ev.payload.settings?.metric !== metric) await ev.action.setSettings({ ...ev.payload.settings, metric });
    this.render(ev.action, metric);
  }

  override onWillDisappear(ev: any): void {
    this.visible.delete(ev.action);
    keyImageUpdateQueue.forget(ev.action);
  }

  override async onDidReceiveSettings(ev: any): Promise<void> {
    if (!ev.action.isKey()) return;
    const metric = this.metricFrom(ev.payload.settings);
    this.visible.set(ev.action, metric);
    this.render(ev.action, metric);
  }

  override async onSendToPlugin(ev: any): Promise<void> {
    const response = await this.runtime.handlePiCommand(ev.payload, (progress) => ev.action.sendToPropertyInspector(progress));
    await ev.action.sendToPropertyInspector(response);
  }

  private metricFrom(settings: SessionSettings | undefined): string {
    return settings?.metric && (ALLOWED as readonly string[]).includes(settings.metric) ? settings.metric : "record";
  }

  private refreshAll(): void {
    for (const [action, metric] of this.visible) this.render(action, metric);
  }

  private render(action: any, metric: string): void {
    const display = sessionDisplay(metric, this.runtime.snapshot().session);
    keyImageUpdateQueue.request(
      action,
      renderKeySvg(display.label, display.value, display.tone, display.subtitle),
      "session"
    );
  }
}
