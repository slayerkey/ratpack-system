import { SingletonAction } from "@elgato/streamdeck";
import { renderKeySvg } from "../render/key-svg.js";
import type { DashboardRuntime } from "../runtime.js";
import { competitiveDisplay, faceitDisplay, type CompetitiveMetric, type FaceitMetric } from "./online-format.js";

export type OnlineMetricSettings = { metric?: string };

type OnlineKind = "competitive" | "faceit";

export class OnlineMetricActionBase extends SingletonAction<OnlineMetricSettings> {
  private readonly visible = new Set<any>();

  constructor(
    private readonly runtime: DashboardRuntime,
    private readonly kind: OnlineKind,
    private readonly allowedMetrics: readonly (CompetitiveMetric | FaceitMetric)[],
    private readonly defaultMetric: CompetitiveMetric | FaceitMetric
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

  private metricFrom(settings: OnlineMetricSettings | undefined): CompetitiveMetric | FaceitMetric {
    const candidate = settings?.metric as CompetitiveMetric | FaceitMetric | undefined;
    return candidate && this.allowedMetrics.includes(candidate) ? candidate : this.defaultMetric;
  }

  private async refreshAll(): Promise<void> {
    await Promise.all([...this.visible].map(async (action) => {
      const settings = await action.getSettings() as OnlineMetricSettings;
      await this.render(action, this.metricFrom(settings));
    }));
  }

  private async render(action: any, metric: CompetitiveMetric | FaceitMetric): Promise<void> {
    const snapshot = this.runtime.snapshot();
    const display = this.kind === "competitive"
      ? competitiveDisplay(metric as CompetitiveMetric, snapshot.online, snapshot.live?.mapName)
      : faceitDisplay(metric as FaceitMetric, snapshot.online);
    await action.setImage(renderKeySvg(display.label, display.value, display.tone, display.subtitle));
  }
}
