import type { RawGsiPayload, RuntimeStatus } from "./core/types.js";
import type { DashboardRuntime } from "./runtime.js";

/**
 * Narrow adapter around DashboardRuntime internals while the host debugging pass
 * separates local GSI lifecycle from the old Property Inspector command lifecycle.
 * Keeping these calls in one file makes the temporary boundary explicit and easy
 * to replace with public runtime methods after the Windows host gate is proven.
 */
type RuntimeInternals = {
  ingest(payload: RawGsiPayload): void;
  updateStatus(patch: Partial<RuntimeStatus>): void;
  globals: Record<string, unknown>;
  refreshOnline(force: boolean): Promise<void>;
  sessionTracker: { reset(): void; snapshot(): unknown };
  publish(patch: Record<string, unknown>): void;
};

function internal(runtime: DashboardRuntime): RuntimeInternals {
  return runtime as unknown as RuntimeInternals;
}

export function ingestGsi(runtime: DashboardRuntime, payload: RawGsiPayload): void {
  internal(runtime).ingest(payload);
}

export function patchRuntimeStatus(runtime: DashboardRuntime, patch: Partial<RuntimeStatus>): void {
  internal(runtime).updateStatus(patch);
}

export function applyRuntimeUserSettings(runtime: DashboardRuntime, settings: object): void {
  const source = settings as Record<string, unknown>;
  const target = internal(runtime);
  target.globals = {
    ...target.globals,
    steamProfile: typeof source.steamProfile === "string" && source.steamProfile.trim() ? source.steamProfile.trim() : undefined,
    faceitApiKey: typeof source.faceitApiKey === "string" && source.faceitApiKey.trim() ? source.faceitApiKey.trim() : undefined,
    leetifyApiKey: typeof source.leetifyApiKey === "string" && source.leetifyApiKey.trim() ? source.leetifyApiKey.trim() : undefined
  };
}

export async function refreshRuntimeOnline(runtime: DashboardRuntime, force: boolean): Promise<void> {
  await internal(runtime).refreshOnline(force);
}

export function resetRuntimeSession(runtime: DashboardRuntime): void {
  const target = internal(runtime);
  target.sessionTracker.reset();
  target.publish({ session: target.sessionTracker.snapshot() });
}
