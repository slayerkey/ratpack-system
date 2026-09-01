import type { LiveMetric, LiveState, RuntimeStatus, SessionMetrics } from "../core/types.js";

export interface DisplayValue {
  label: string;
  value: string;
  subtitle?: string;
  tone?: "default" | "good" | "warn" | "danger" | "muted";
}

function decimal(value: number, digits = 2): string {
  return Number.isFinite(value) ? value.toFixed(digits) : "0.00";
}

function compactWeapon(name?: string): string {
  if (!name) return "NONE";
  return name.replace(/^weapon_/, "").replaceAll("_", " ").toUpperCase();
}

function setupStageLabel(status: RuntimeStatus): string {
  switch (status.setupStage) {
    case "finding-cs2": return "FINDING CS2";
    case "starting-listener": return "STARTING LOCAL";
    case "writing-config": return "INSTALLING GSI";
    case "saving-settings": return "SAVING SETUP";
    case "checking-cs2": return "CHECKING CS2";
    default: return "AUTOMATIC";
  }
}

export function liveDisplay(metric: LiveMetric, live: LiveState | undefined, session: SessionMetrics, status: RuntimeStatus): DisplayValue {
  if (!status.gsiConfigured) {
    if (status.error) return { label: "CS2 LIVE", value: "ERROR", subtitle: "OPEN SETUP", tone: "danger" };
    return { label: "CS2 LIVE", value: "SETTING UP", subtitle: setupStageLabel(status), tone: "warn" };
  }
  if (!live || !status.gsiConnected) {
    if (status.gsiRestartRequired && status.cs2Running) return { label: "CS2 LIVE", value: "RESTART", subtitle: "CS2 ONCE", tone: "warn" };
    if (status.gsiRestartRequired && !status.cs2Running) return { label: "CS2 LIVE", value: "READY", subtitle: "LAUNCH CS2", tone: "warn" };
    if (!status.cs2Running) return { label: "CS2 LIVE", value: "OFFLINE", subtitle: "LAUNCH CS2", tone: "muted" };
    return { label: "CS2 LIVE", value: "WAITING", subtitle: "FOR GAME DATA", tone: "warn" };
  }

  switch (metric) {
    case "score": return { label: "SCORE", value: `${live.ctScore} : ${live.tScore}`, subtitle: `${live.playerTeam}` };
    case "round": return { label: "ROUND", value: live.roundNumber === undefined ? "--" : `${live.roundNumber + 1}`, subtitle: (live.roundPhase ?? live.mapPhase ?? "").toUpperCase() };
    case "kills": return { label: "KILLS", value: String(live.kills) };
    case "deaths": return { label: "DEATHS", value: String(live.deaths) };
    case "assists": return { label: "ASSISTS", value: String(live.assists) };
    case "kd": return { label: "K/D", value: decimal(live.deaths === 0 ? live.kills : live.kills / live.deaths) };
    case "adr": return { label: "MATCH ADR", value: decimal(session.adr, 1) };
    case "hs": return { label: "MATCH HS%", value: `${decimal(session.hsPercent, 0)}%` };
    case "health": return { label: "HEALTH", value: live.health === undefined ? "--" : String(live.health), tone: live.health !== undefined && live.health <= 25 ? "danger" : "good" };
    case "armor": return { label: "ARMOR", value: live.armor === undefined ? "--" : String(live.armor), subtitle: live.helmet ? "HELMET" : undefined };
    case "money": return { label: "MONEY", value: live.money === undefined ? "--" : `$${live.money.toLocaleString("en-US")}` };
    case "equipment": return { label: "EQUIPMENT", value: live.equipmentValue === undefined ? "--" : `$${live.equipmentValue.toLocaleString("en-US")}` };
    case "weapon": return { label: "WEAPON", value: compactWeapon(live.currentWeapon?.name) };
    case "ammo": {
      const weapon = live.currentWeapon;
      const value = weapon?.ammoClip === undefined ? "--" : weapon.ammoReserve === undefined ? String(weapon.ammoClip) : `${weapon.ammoClip}/${weapon.ammoReserve}`;
      return { label: "AMMO", value };
    }
    case "bomb": return { label: "BOMB", value: (live.bombState ?? "--").toUpperCase() };
    case "map": return { label: "MAP", value: (live.mapName ?? "--").replace(/^de_/, "").toUpperCase() };
    case "team": return { label: "TEAM", value: live.playerTeam };
  }
}

export function sessionDisplay(metric: string, session: SessionMetrics): DisplayValue {
  switch (metric) {
    case "record": return { label: "SESSION", value: `${session.wins}W ${session.losses}L`, subtitle: `${session.matches} MATCH${session.matches === 1 ? "" : "ES"}` };
    case "matches": return { label: "MATCHES", value: String(session.matches) };
    case "kd": return { label: "MATCH K/D", value: decimal(session.kd) };
    case "adr": return { label: "MATCH ADR", value: decimal(session.adr, 1) };
    case "hs": return { label: "MATCH HS%", value: `${decimal(session.hsPercent, 0)}%` };
    default: return { label: "SESSION", value: "--" };
  }
}

export function statusDisplay(status: RuntimeStatus): DisplayValue {
  if (status.error) return { label: "CS2 STATUS", value: "ERROR", subtitle: "OPEN SETUP", tone: "danger" };
  if (!status.gsiConfigured) return { label: "CS2 STATUS", value: "SETTING UP", subtitle: setupStageLabel(status), tone: "warn" };
  if (status.gsiConnected) return { label: "CS2 STATUS", value: "LIVE", subtitle: "CONNECTED", tone: "good" };
  if (status.gsiRestartRequired && status.cs2Running) return { label: "CS2 STATUS", value: "RESTART", subtitle: "CS2 ONCE", tone: "warn" };
  if (status.gsiRestartRequired) return { label: "CS2 STATUS", value: "READY", subtitle: "LAUNCH CS2", tone: "warn" };
  if (status.cs2Running) return { label: "CS2 STATUS", value: "WAITING", subtitle: "FOR GAME DATA", tone: "warn" };
  return { label: "CS2 STATUS", value: "READY", subtitle: "LAUNCH CS2", tone: "muted" };
}
