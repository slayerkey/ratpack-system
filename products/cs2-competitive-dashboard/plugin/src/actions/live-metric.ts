import { SingletonAction } from "@elgato/streamdeck";
import type { LiveMetric } from "../core/types.js";
import { beginKeyRefresh, finishKeyRefresh } from "../diagnostics/render-trace.js";
import { keyImageUpdateQueue } from "../render/key-update-queue.js";
import { renderKeySvg } from "../render/key-svg.js";
import type { DashboardRuntime } from "../runtime.js";
import { liveDisplay } from "./format.js";

export type MetricSettings = { metric?: string };

export class LiveMetricActionBase extends SingletonAction<MetricSettings> {
  private readonly visible = new Map<any, LiveMetric>();

  constructor(
    private readonly runtime: DashboardRuntime,
    private readonly allowedMetrics: readonly LiveMetric[],
    private readonly defaultMetric: LiveMetric = "score"
  ) {
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

  private metricFrom(settings: MetricSettings | undefined): LiveMetric {
    const candidate = settings?.metric as LiveMetric | undefined;
    return candidate && this.allowedMetrics.includes(candidate) ? candidate : this.defaultMetric;
  }

  private refreshAll(): void {
    const traced = beginKeyRefresh("live", this.visible.size);
    for (const [action, metric] of this.visible) this.render(action, metric);
    finishKeyRefresh("live", this.visible.size, traced);
  }

  private render(action: any, metric: LiveMetric): void {
    const snapshot = this.runtime.snapshot();
    const display = liveDisplay(metric, snapshot.live, snapshot.session, snapshot.status);
    keyImageUpdateQueue.request(
      action,
      renderKeySvg(display.label, display.value, display.tone, display.subtitle),
      "live"
    );
  }
}
