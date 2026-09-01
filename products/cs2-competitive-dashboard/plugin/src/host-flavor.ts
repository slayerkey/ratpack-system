export type ProductFlavor = "pro" | "lite";

/**
 * Both Marketplace products are bundled from one source tree, but each bundle lives
 * under its immutable plugin UUID directory. import.meta.url therefore gives us a
 * stable flavor signal even if Stream Deck changes the process working directory.
 * cwd and argv remain useful fallbacks for source tests and unusual launchers.
 */
export function currentProductFlavor(): ProductFlavor {
  const marker = `${import.meta.url}\n${process.cwd()}\n${process.argv.join("\n")}`.toLowerCase();
  return marker.includes("cs2-competitive-dashboard-lite") ? "lite" : "pro";
}

export function defaultGsiPortForFlavor(flavor = currentProductFlavor()): number {
  return flavor === "lite" ? 32147 : 32123;
}

export function gsiFilenameForFlavor(flavor = currentProductFlavor()): string {
  return `gamestate_integration_packrat_cs2_dashboard_${flavor}.cfg`;
}

export const LEGACY_SHARED_GSI_FILENAME = "gamestate_integration_packrat_cs2_dashboard.cfg";
