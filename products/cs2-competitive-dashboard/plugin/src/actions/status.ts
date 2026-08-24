import { SingletonAction } from "@elgato/streamdeck";
import { renderKeySvg } from "../render/key-svg.js";
import type { DashboardRuntime } from "../runtime.js";
import { statusDisplay } from "./format.js";

export class StatusActionBase extends SingletonAction {
  private readonly visible = new Set<any>();

  constructor(private readonly runtime: DashboardRuntime) {
    super();
    this.runtime.subscribe(() => void this.refreshAll());
  }

  override async onWillAppear(ev: any): Promise<void> {
    if (!ev.action.isKey()) return;
    this.visible.add(ev.action);
    await this.render(ev.action);
  }

  override onWillDisappear(ev: any): void {
    this.visible.delete(ev.action);
  }

  override async onSendToPlugin(ev: any): Promise<void> {
    const response = await this.runtime.handlePiCommand(ev.payload);
    await ev.action.sendToPropertyInspector(response);
  }

  private async refreshAll(): Promise<void> {
    await Promise.all([...this.visible].map((action) => this.render(action)));
  }

  private async render(action: any): Promise<void> {
    const display = statusDisplay(this.runtime.snapshot().status);
    await action.setImage(renderKeySvg(display.label, display.value, display.tone, display.subtitle));
  }
}
