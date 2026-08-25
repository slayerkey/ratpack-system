import { SingletonAction } from "@elgato/streamdeck";
import type { LiveMetric } from "../core/types.js";
import { beginKeyRefresh, failKeyRefresh, finishKeyRefresh } from "../diagnostics/render-trace.js";
import { renderKeySvg } from "../render/key-svg.js";
import type { DashboardRuntime } from "../runtime.js";
import { liveDisplay } from "./format.js";

export type MetricSettings = { metric?: string };

export class LiveMetricActionBase extends SingletonAction<MetricSettings> {
  private readonly visible = new Set<any>();

  constructor(
    private readonly runtime: DashboardRuntime,
    private readonly allowedMetrics: readonly LiveMetric[],
    private readonly defaultMetric: LiveMetric = "score"
  ) {
    super();
    this.runtime.subscribe(() => {
      setTimeout(() => void this.refreshAll(), 0);
    });
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
    const response = await this.runtime.handlePiCommand(ev.payload, (progress) => ev.action.sendToPropertyInspector(progress));
    await ev.action.sendToPropertyInspector(response);
  }

  private metricFrom(settings: MetricSettings | undefined): LiveMetric {
    const candidate = settings?.metric as LiveMetric | undefined;
    return candidate && this.allowedMetrics.includes(candidate) ? candidate : this.defaultMetric;
  }

  private async refreshAll(): Promise<void> {
    const traced = beginKeyRefresh("live", this.visible.size);
    try {
      await Promise.all([...this.visible].map(async (action) => {
        const settings = await action.getSettings() as MetricSettings;
        await this.render(action, this.metricFrom(settings));
      }));
      finishKeyRefresh("live", this.visible.size, traced);
    } catch (error) {
      failKeyRefresh("live", error, traced);
      throw error;
    }
  }

  private async render(action: any, metric: LiveMetric): Promise<void> {
    const snapshot = this.runtime.snapshot();
    const display = liveDisplay(metric, snapshot.live, snapshot.session, snapshot.status);
    await action.setImage(renderKeySvg(display.label, display.value, display.tone, display.subtitle));
  }
}
