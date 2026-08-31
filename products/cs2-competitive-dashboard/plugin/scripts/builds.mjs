export const CREATOR_URL = "https://marketplace.elgato.com/maker/packrat";

export const builds = [
  {
    flavor: "pro",
    uuid: "com.packrat.cs2-competitive-dashboard-pro",
    name: "CS2 Competitive Dashboard Pro",
    output: "out/com.packrat.cs2-competitive-dashboard-pro.sdPlugin",
    footerLabel: "More from PackRat",
    footerUrl: CREATOR_URL,
    liveMetrics: ["score", "round", "kills", "deaths", "assists", "kd", "adr", "hs", "health", "armor", "money", "equipment", "weapon", "ammo", "bomb", "map", "team"],
    sessionMetrics: ["record", "matches", "kd", "adr", "hs"],
    competitiveMetrics: ["premier", "current-map-rank", "best-map-rank", "recent-result", "win-rate", "leetify-rating"],
    faceitMetrics: ["elo", "level", "region", "kd", "hs", "win-rate", "recent-record", "recent-match"],
    actions: [
      { id: "live", name: "Live Metric", tooltip: "Show a configurable live CS2 metric." },
      { id: "session", name: "Session Metric", tooltip: "Show current-session CS2 performance." },
      { id: "competitive", name: "Competitive Metric", tooltip: "Show Premier, Competitive rank, recent form, or Leetify-backed competitive data." },
      { id: "faceit", name: "FACEIT Metric", tooltip: "Show FACEIT Elo, level, stats, or recent form." },
      { id: "status", name: "CS2 Status", tooltip: "Show CS2 live tracking and setup status." }
    ]
  },
  {
    flavor: "lite",
    uuid: "com.packrat.cs2-competitive-dashboard-lite",
    name: "CS2 Competitive Dashboard Lite",
    output: "out/com.packrat.cs2-competitive-dashboard-lite.sdPlugin",
    footerLabel: "Explore PackRat",
    footerUrl: CREATOR_URL,
    liveMetrics: ["score", "health", "money", "map"],
    sessionMetrics: [],
    competitiveMetrics: [],
    faceitMetrics: [],
    actions: [
      { id: "live", name: "Live Metric", tooltip: "Show live Score, Health, Money, or Map." },
      { id: "status", name: "CS2 Status", tooltip: "Show CS2 live tracking and setup status." }
    ]
  }
];
