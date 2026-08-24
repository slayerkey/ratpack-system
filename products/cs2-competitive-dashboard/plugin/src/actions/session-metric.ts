import { SingletonAction } from "@elgato/streamdeck";
import { renderKeySvg } from "../render/key-svg.js";
import type { DashboardRuntime } from "../runtime.js";
import { sessionDisplay } from "./format.js";

export type SessionSettings = { metric?: string };

const ALLOWED = ["record", "matches", "kd", "adr", "hs"] as const;

export class SessionMetricActionBase extends SingletonAction<SessionSettings> {
  private readonly visible = new Set<any>();

  constructor(private readonly runtime: DashboardRuntime) {
    super();
    this.runtime.subscribe(() => void this.refreshAll());
  }

  override async onWillAppear(ev: any): Promise<void> {
    if (!ev.action.isKey()) return;
    this.visible.add(ev.action);
    const metric = this.metricFrom(ev.payload.settings);
    if (ev.payload.settings?.metric !== metric) await ev.action.setSettings({ ...ev.payload.settings, metric });
    await this.render(ev.action, metric);
  }

  override onWillDisappear(ev: any): void {
    this.visible.delete(ev.action);
  }

  override async onDidReceiveSettings(ev: any): Promise<void> {
    if (!ev.action.isKey()) return;
    await this.render(ev.action, this.metricFrom(ev.payload.settings));
  }

  override async onSendToPlugin(ev: any): Promise<void> {
    const response = await this.runtime.handlePiCommand(ev.payload);
    await ev.action.sendToPropertyInspector(response);
  }

  private metricFrom(settings: SessionSettings | undefined): string {
    return settings?.metric && (ALLOWED as readonly string[]).includes(settings.metric) ? settings.metric : "record";
  }

  private async refreshAll(): Promise<void> {
    await Promise.all([...this.visible].map(async (action) => {
      const settings = await action.getSettings() as SessionSettings;
      await this.render(action, this.metricFrom(settings));
    }));
  }

  private async render(action: any, metric: string): Promise<void> {
    const display = sessionDisplay(metric, this.runtime.snapshot().session);
    await action.setImage(renderKeySvg(display.label, display.value, display.tone, display.subtitle));
  }
}
