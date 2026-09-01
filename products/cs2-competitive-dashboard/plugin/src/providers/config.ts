// Provider rank data is slow-moving. Each Pro install uses the customer's own
// FACEIT and Leetify keys, so there is no shared PackRat provider quota. We still
// keep background polling conservative and refresh immediately after matches or on
// explicit user request.
const ONLINE_PROFILE_REFRESH_BASE_MS = 60 * 60 * 1000;
const ONLINE_PROFILE_REFRESH_JITTER_MS = 10 * 60 * 1000;

export function nextOnlineProfileRefreshDelay(random = Math.random): number {
  const normalized = Math.min(1, Math.max(0, random()));
  return Math.round(
    ONLINE_PROFILE_REFRESH_BASE_MS - ONLINE_PROFILE_REFRESH_JITTER_MS
      + normalized * ONLINE_PROFILE_REFRESH_JITTER_MS * 2
  );
}

export const ONLINE_PROFILE_REFRESH_MS = nextOnlineProfileRefreshDelay();
