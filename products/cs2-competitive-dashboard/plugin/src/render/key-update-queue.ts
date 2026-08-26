import { hostDiagnostics } from "../diagnostics/host.js";

type KeyAction = {
  setImage(image: string): Promise<void>;
};

type PendingImage = {
  image: string;
  family: string;
};

type KeyState = {
  sent?: string;
  desired?: PendingImage;
  scheduled: boolean;
  running: boolean;
  disposed: boolean;
};

type ErrorReporter = (family: string, error: unknown) => void;

const ERROR_LOG_INTERVAL_MS = 15_000;

export class KeyImageUpdateQueue {
  private readonly states = new Map<KeyAction, KeyState>();
  private serial: Promise<void> = Promise.resolve();
  private readonly lastErrorLog = new Map<string, number>();
  private idleWaiters: Array<() => void> = [];

  constructor(private readonly reportError: ErrorReporter = defaultErrorReporter) {}

  request(action: KeyAction, image: string, family: string): void {
    let state = this.states.get(action);
    if (!state) {
      state = { scheduled: false, running: false, disposed: false };
      this.states.set(action, state);
    }

    state.disposed = false;
    if (state.sent === image && !state.desired) return;
    state.desired = { image, family };
    this.schedule(action, state);
  }

  forget(action: KeyAction): void {
    const state = this.states.get(action);
    if (!state) return;
    state.disposed = true;
    state.desired = undefined;
    this.states.delete(action);
    this.notifyIdleIfNeeded();
  }

  async waitForIdle(): Promise<void> {
    if (this.isIdle()) return;
    await new Promise<void>((resolve) => this.idleWaiters.push(resolve));
  }

  private schedule(action: KeyAction, state: KeyState): void {
    if (state.scheduled || state.running || state.disposed) return;
    state.scheduled = true;
    queueMicrotask(() => {
      state.scheduled = false;
      if (state.running || state.disposed || !state.desired) {
        this.notifyIdleIfNeeded();
        return;
      }
      state.running = true;
      void this.pump(action, state);
    });
  }

  private async pump(action: KeyAction, state: KeyState): Promise<void> {
    try {
      while (!state.disposed && state.desired) {
        const next = state.desired;
        state.desired = undefined;
        if (state.sent === next.image) continue;

        const succeeded = await this.enqueue(async () => {
          if (state.disposed) return false;
          try {
            await action.setImage(next.image);
            return true;
          } catch (error) {
            this.logError(next.family, error);
            return false;
          }
        });

        if (succeeded) state.sent = next.image;
      }
    } finally {
      state.running = false;
      if (!state.disposed && state.desired) this.schedule(action, state);
      this.notifyIdleIfNeeded();
    }
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const run = this.serial.then(operation, operation);
    this.serial = run.then(() => undefined, () => undefined);
    return run;
  }

  private logError(family: string, error: unknown): void {
    const now = Date.now();
    const previous = this.lastErrorLog.get(family) ?? 0;
    if (previous && now - previous < ERROR_LOG_INTERVAL_MS) return;
    this.lastErrorLog.set(family, now);
    this.reportError(family, error);
  }

  private isIdle(): boolean {
    for (const state of this.states.values()) {
      if (state.scheduled || state.running || state.desired) return false;
    }
    return true;
  }

  private notifyIdleIfNeeded(): void {
    if (!this.isIdle() || this.idleWaiters.length === 0) return;
    const waiters = this.idleWaiters;
    this.idleWaiters = [];
    for (const resolve of waiters) resolve();
  }
}

function defaultErrorReporter(family: string, error: unknown): void {
  hostDiagnostics.event("Stream Deck key image update failed", {
    family,
    error: error instanceof Error ? { name: error.name, message: error.message } : String(error)
  });
}

export const keyImageUpdateQueue = new KeyImageUpdateQueue();
