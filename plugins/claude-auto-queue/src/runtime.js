import streamDeck from "@elgato/streamdeck";
import { AutoQueueService } from "./core/queue-service.js";
import { StateStore } from "./core/state-store.js";
import { IntegrationManager } from "./core/integration-manager.js";
import { LocalServer } from "./core/local-server.js";
import { startClaudePoller } from "./core/claude-client.js";

class Runtime {
  constructor() {
    this.service = new AutoQueueService({ store: new StateStore() });
    this.integration = new IntegrationManager();
    this.server = new LocalServer({
      service: this.service,
      integration: this.integration,
      logger: streamDeck.logger
    });
    this.stopPoller = null;
    this.started = false;
  }

  async start() {
    if (this.started) return;
    this.started = true;
    await this.service.initialize();
    await this.server.start();
    this.stopPoller = startClaudePoller(this.service, {
      intervalMs: 5000,
      onStatus: (status) => {
        if (!status.ok) {
          streamDeck.logger.debug("Claude session reconciliation unavailable", status.error);
        }
      }
    });
  }

  async stop() {
    this.stopPoller?.();
    this.stopPoller = null;
    await this.server.stop();
    this.started = false;
  }
}

export const runtime = new Runtime();
