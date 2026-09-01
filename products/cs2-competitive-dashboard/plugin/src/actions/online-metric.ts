import { SingletonAction } from "@elgato/streamdeck";
import { keyImageUpdateQueue } from "../render/key-update-queue.js";
import { renderKeySvg } from "../render/key-svg.js";
import type { DashboardRuntime } from "../runtime.js";
import { competitiveDisplay, faceitDisplay, type CompetitiveMetric, type FaceitMetric } from "./online-format.js";

export type OnlineMetricSettings = { metric?: string };

type OnlineKind = "competitive" | "faceit";

export class OnlineMetricActionBase extends SingletonAction<OnlineMetricSettings> {
  private readonly visible = new Map<any, CompetitiveMetric | FaceitMetric>();

  constructor(
    private readonly runtime: DashboardRuntime,
    private readonly kind: OnlineKind,
    private readonly allowedMetrics: readonly (CompetitiveMetric | FaceitMetric)[],
    private readonly defaultMetric: CompetitiveMetric | FaceitMetric
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

  private metricFrom(settings: OnlineMetricSettings | undefined): CompetitiveMetric | FaceitMetric {
    const candidate = settings?.metric as CompetitiveMetric | FaceitMetric | undefined;
    return candidate && this.allowedMetrics.includes(candidate) ? candidate : this.defaultMetric;
  }

  private refreshAll(): void {
    for (const [action, metric] of this.visible) this.render(action, metric);
  }

  private render(action: any, metric: CompetitiveMetric | FaceitMetric): void {
    const snapshot = this.runtime.snapshot();
    const display = this.kind === "competitive"
      ? competitiveDisplay(metric as CompetitiveMetric, snapshot.online, snapshot.live?.mapName)
      : faceitDisplay(metric as FaceitMetric, snapshot.online);
    keyImageUpdateQueue.request(
      action,
      renderKeySvg(display.label, display.value, display.tone, display.subtitle),
      this.kind
    );
  }
}
