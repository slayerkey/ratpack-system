import { SingletonAction } from "@elgato/streamdeck";
import { keyImageUpdateQueue } from "../render/key-update-queue.js";
import { renderKeySvg } from "../render/key-svg.js";
import type { DashboardRuntime } from "../runtime.js";
import { statusDisplay } from "./format.js";

export class StatusActionBase extends SingletonAction {
  private readonly visible = new Set<any>();

  constructor(private readonly runtime: DashboardRuntime) {
    super();
    this.runtime.subscribe(() => this.refreshAll());
  }

  override async onWillAppear(ev: any): Promise<void> {
    if (!ev.action.isKey()) return;
    this.visible.add(ev.action);
    this.render(ev.action);
  }

  override onWillDisappear(ev: any): void {
    this.visible.delete(ev.action);
    keyImageUpdateQueue.forget(ev.action);
  }

  override async onSendToPlugin(ev: any): Promise<void> {
    const response = await this.runtime.handlePiCommand(ev.payload, (progress) => ev.action.sendToPropertyInspector(progress));
    await ev.action.sendToPropertyInspector(response);
  }

  private refreshAll(): void {
    for (const action of this.visible) this.render(action);
  }

  private render(action: any): void {
    const display = statusDisplay(this.runtime.snapshot().status);
    keyImageUpdateQueue.request(
      action,
      renderKeySvg(display.label, display.value, display.tone, display.subtitle),
      "status"
    );
  }
}
