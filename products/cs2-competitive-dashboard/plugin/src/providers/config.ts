// Filled with the production RatPack gateway URL only after the provider gateway is deployed
// and the FACEIT / Leetify commercial release gates are cleared.
export const PRO_GATEWAY_BASE_URL = "";

// Rank and profile data does not need live polling. Normal background refreshes are
// intentionally conservative because FACEIT documents 429 responses but does not
// publish a numeric Data API quota. Match completion and manual refresh still force
// an immediate provider update.
export const ONLINE_PROFILE_REFRESH_MS = 30 * 60 * 1000;
export const ONLINE_PROFILE_REFRESH_JITTER_MS = 5 * 60 * 1000;

export function nextOnlineProfileRefreshDelay(random = Math.random): number {
  const normalized = Math.min(1, Math.max(0, random()));
  return Math.round(
    ONLINE_PROFILE_REFRESH_MS - ONLINE_PROFILE_REFRESH_JITTER_MS
      + normalized * ONLINE_PROFILE_REFRESH_JITTER_MS * 2
  );
}
