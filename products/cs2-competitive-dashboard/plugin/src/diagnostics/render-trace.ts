import { hostDiagnostics } from "./host.js";

const LAST = new Map<string, number>();
const INTERVAL_MS = 30_000;

export function beginKeyRefresh(family: string, visibleKeys: number): boolean {
  const now = Date.now();
  const previous = LAST.get(family) ?? 0;
  if (previous && now - previous < INTERVAL_MS) return false;
  LAST.set(family, now);
  hostDiagnostics.event("key refresh started", { family, visibleKeys });
  return true;
}

export function finishKeyRefresh(family: string, visibleKeys: number, traced: boolean): void {
  if (!traced) return;
  hostDiagnostics.event("key refresh finished", { family, visibleKeys });
}

export function failKeyRefresh(family: string, error: unknown, traced: boolean): void {
  if (!traced) return;
  hostDiagnostics.error("key refresh failed", error, { lastEvent: `key refresh failed: ${family}` });
}
