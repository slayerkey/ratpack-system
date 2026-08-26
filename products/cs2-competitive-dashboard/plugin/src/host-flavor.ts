export type ProductFlavor = "pro" | "lite";

/**
 * Both Marketplace products are bundled from the same source tree, but Stream Deck
 * launches each plugin from its UUID named .sdPlugin directory. Using the process
 * location keeps low level host modules flavor aware without depending on Property
 * Inspector settings or another asynchronous SDK round trip.
 */
export function currentProductFlavor(): ProductFlavor {
  const marker = `${process.cwd()}\n${process.argv.join("\n")}`.toLowerCase();
  return marker.includes("cs2-competitive-dashboard-lite") ? "lite" : "pro";
}

export function defaultGsiPortForFlavor(flavor = currentProductFlavor()): number {
  return flavor === "lite" ? 32147 : 32123;
}

export function gsiFilenameForFlavor(flavor = currentProductFlavor()): string {
  return `gamestate_integration_packrat_cs2_dashboard_${flavor}.cfg`;
}

export const LEGACY_SHARED_GSI_FILENAME = "gamestate_integration_packrat_cs2_dashboard.cfg";
