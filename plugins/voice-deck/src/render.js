import { initials, normalizeAccent, pickSpotlight, safeText, speakingCount, truncate } from "./model.js";

const BG = "#090B10";
const FG = "#F4F6F8";
const MUTED = "#8B93A1";
const DANGER = "#FF5D6C";
const DISCORD = "#7289DA";

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function text(x, y, value, size, opts = {}) {
  const weight = opts.weight || 700;
  const fill = opts.fill || FG;
  const anchor = opts.anchor || "middle";
  const opacity = opts.opacity ?? 1;
  const spacing = opts.spacing ?? 0;
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="Arial,Segoe UI,sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}" opacity="${opacity}" letter-spacing="${spacing}">${esc(value)}</text>`;
}

function iconMic(x, y, color = FG, slash = false) {
  return `<g transform="translate(${x} ${y})" fill="none" stroke="${color}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">
    <rect x="-11" y="-29" width="22" height="42" rx="11"/>
    <path d="M-25 4c0 17 11 27 25 27S25 21 25 4M0 31v15M-14 46h28"/>
    ${slash ? '<path d="M-34 -34L34 34" stroke-width="8"/>' : ""}
  </g>`;
}

function iconHeadphones(x, y, color = FG, slash = false) {
  return `<g transform="translate(${x} ${y})" fill="none" stroke="${color}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">
    <path d="M-32 4v-9a32 32 0 0164 0v9"/>
    <path d="M-32 1h10v33h-7a10 10 0 01-10-10V11A10 10 0 01-32 1zM32 1H22v33h7a10 10 0 0010-10V11A10 10 0 0032 1z"/>
    ${slash ? '<path d="M-38 -36L38 40" stroke-width="8"/>' : ""}
  </g>`;
}

function iconUsers(x, y, color = FG) {
  return `<g transform="translate(${x} ${y})" fill="none" stroke="${color}" stroke-width="6" stroke-linecap="round"><circle cx="-15" cy="-13" r="13"/><circle cx="18" cy="-9" r="10"/><path d="M-39 28c2-18 13-27 24-27S7 10 9 28M12 28c1-13 8-20 17-20s17 7 18 20"/></g>`;
}

function iconLink(x, y, color = FG) {
  return `<g transform="translate(${x} ${y})" fill="none" stroke="${color}" stroke-width="7" stroke-linecap="round"><path d="M-5-18l9-9a20 20 0 0128 28l-12 12a20 20 0 01-28 0M5 18l-9 9a20 20 0 01-28-28l12-12a20 20 0 0128 0"/><path d="M-14 14l28-28"/></g>`;
}

function frame(content, accent, opts = {}) {
  const active = opts.active;
  const edge = active ? accent : "#171B24";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">
    <rect width="144" height="144" rx="25" fill="${BG}"/>
    <rect x="4" y="4" width="136" height="136" rx="21" fill="none" stroke="${edge}" stroke-width="${active ? 6 : 3}"/>
    ${content}
  </svg>`;
}

export function svgDataUri(svg) {
  return `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
}

export function connectionLabel(snapshot) {
  if (snapshot?.auth?.stage === "authorizing") return ["AUTH", "IN DISCORD"];
  if (["exchanging", "authenticating"].includes(snapshot?.auth?.stage)) return ["AUTH", "FINISHING"];
  if (snapshot?.auth?.stage === "failed") return ["AUTH", "ERROR"];
  if (!snapshot?.discord?.ready) {
    if (snapshot?.discord?.handshake === "connecting") return ["DISCORD", "CONNECTING"];
    return ["DISCORD", "CLOSED"];
  }
  if (!snapshot?.discord?.authenticated) return ["AUTH", "NEEDED"];
  return ["VOICE DECK", "READY"];
}

function orderedMembers(snapshot, ordering = "stable") {
  const members = Array.isArray(snapshot?.members) ? snapshot.members.slice() : [];
  if (ordering !== "speaking-first") return members;
  return members.sort((a, b) => {
    const selfDelta = Number(Boolean(b.self)) - Number(Boolean(a.self));
    if (selfDelta) return selfDelta;
    const ap = a.speaking ? 2 : a.recentlySpeaking ? 1 : 0;
    const bp = b.speaking ? 2 : b.recentlySpeaking ? 1 : 0;
    if (ap !== bp) return bp - ap;
    return a.order - b.order;
  });
}

export function memberForAction(kind, snapshot, settings = {}, now = Date.now()) {
  const members = orderedMembers(snapshot, settings.ordering);
  if (kind === "member") {
    const wanted = String(settings.memberId || "");
    return members.find((member) => member.id === wanted) || null;
  }
  if (kind === "member-slot") {
    const index = Math.max(0, Math.min(49, Number(settings.slotIndex || 1) - 1));
    return members[index] || null;
  }
  if (kind === "spotlight") return pickSpotlight(members, now);
  return null;
}

function renderConnection(snapshot, accent, title = "CONNECTION") {
  const [top, bottom] = connectionLabel(snapshot);
  const ready = snapshot?.discord?.authenticated;
  const color = ready ? accent : snapshot?.auth?.stage === "failed" ? DANGER : DISCORD;
  return frame(`${iconLink(72, 56, color)}${text(72, 107, top, 14, { fill: color, spacing: 1 })}${text(72, 125, bottom, 12, { fill: FG })}`, accent, { active: ready });
}

function renderStatus(snapshot, accent, settings) {
  if (!snapshot?.discord?.authenticated) return renderConnection(snapshot, accent, "STATUS");
  const channel = snapshot.channel;
  if (!channel) {
    return frame(`${iconUsers(72, 57, MUTED)}${text(72, 110, "NOT IN", 15, { fill: MUTED })}${text(72, 128, "VOICE", 14)}`, accent);
  }
  const name = settings.showChannel === false ? "VOICE" : truncate(channel.name || "Voice", 14);
  return frame(`${iconUsers(72, 48, accent)}${text(72, 96, name, 16)}${text(72, 121, `${snapshot.members.length} in voice`, 12, { fill: MUTED })}`, accent, { active: speakingCount(snapshot.members) > 0 });
}

function renderToggle(kind, snapshot, accent) {
  if (!snapshot?.discord?.authenticated) return renderConnection(snapshot, accent);
  const isMute = kind === "mute";
  const active = isMute ? Boolean(snapshot.voice?.mute) : Boolean(snapshot.voice?.deaf);
  const color = active ? DANGER : accent;
  const icon = isMute ? iconMic(72, 59, color, active) : iconHeadphones(72, 59, color, active);
  const label = isMute ? (active ? "MUTED" : "MUTE") : (active ? "DEAFENED" : "DEAFEN");
  return frame(`${icon}${text(72, 121, label, 14, { fill: color, spacing: 1 })}`, accent, { active });
}

function renderCombined(snapshot, accent) {
  if (!snapshot?.discord?.authenticated) return renderConnection(snapshot, accent);
  const mute = Boolean(snapshot.voice?.mute);
  const deaf = Boolean(snapshot.voice?.deaf);
  const color = mute || deaf ? DANGER : accent;
  return frame(`${iconMic(50, 55, color, mute)}${iconHeadphones(99, 55, color, deaf)}${text(72, 118, mute ? "MUTED" : "TAP MUTE", 12, { fill: mute ? DANGER : FG })}${text(72, 133, deaf ? "DEAFENED" : "HOLD DEAFEN", 9, { fill: deaf ? DANGER : MUTED })}`, accent, { active: mute || deaf });
}

function renderChannel(snapshot, accent, settings) {
  if (!snapshot?.discord?.authenticated) return renderConnection(snapshot, accent);
  if (!snapshot.channel) return frame(`${text(72, 55, "NO VOICE", 18, { fill: MUTED })}${text(72, 82, "Join a", 13)}${text(72, 101, "channel", 13)}`, accent);
  const server = settings.showServer === false ? "" : truncate(snapshot.guild?.name || "Discord", 14);
  const channel = truncate(snapshot.channel?.name || "Voice", settings.displayMode === "compact" ? 13 : 16);
  const content = `${text(72, 30, server, 10, { fill: MUTED, spacing: 0.8 })}${text(72, 66, channel, 18)}${text(72, 101, `${snapshot.members.length}`, 29, { fill: accent })}${text(72, 123, snapshot.members.length === 1 ? "MEMBER" : "MEMBERS", 10, { fill: MUTED, spacing: 1.5 })}`;
  return frame(content, accent, { active: speakingCount(snapshot.members) > 0 });
}

function renderAvatar(member, avatarData, accent, speaking, pulsePhase, showAvatar = true, fallbackInitials = true) {
  const cx = 72;
  const cy = 59;
  const avatarRadius = 31;
  const ringRadius = 35;
  const ringWidth = speaking ? (pulsePhase ? 8 : 6) : 3;
  const ringColor = speaking ? accent : "#343B49";
  const imageX = cx - avatarRadius;
  const imageY = cy - avatarRadius;
  const imageSize = avatarRadius * 2;
  const ring = `<circle cx="${cx}" cy="${cy}" r="${ringRadius}" fill="none" stroke="${ringColor}" stroke-width="${ringWidth}"/>`;

  if (showAvatar && avatarData) {
    const circlePath = `M ${cx} ${cy - avatarRadius} A ${avatarRadius} ${avatarRadius} 0 1 1 ${cx} ${cy + avatarRadius} A ${avatarRadius} ${avatarRadius} 0 1 1 ${cx} ${cy - avatarRadius} Z`;
    const mattePath = `M ${imageX} ${imageY} H ${imageX + imageSize} V ${imageY + imageSize} H ${imageX} Z ${circlePath}`;
    const avatar = `<circle cx="${cx}" cy="${cy}" r="${avatarRadius}" fill="#151A24"/><image href="${esc(avatarData)}" x="${imageX}" y="${imageY}" width="${imageSize}" height="${imageSize}" preserveAspectRatio="xMidYMid slice"/><path d="${mattePath}" fill="${BG}" fill-rule="evenodd"/>`;
    return `${avatar}${ring}`;
  }

  const base = `<circle cx="${cx}" cy="${cy}" r="${avatarRadius}" fill="#151A24"/>`;
  const label = fallbackInitials ? initials(member?.displayName) : "•";
  return `${base}${text(cx, cy + 9, label, 23, { fill: speaking ? FG : MUTED })}${ring}`;
}

function renderMember(kind, snapshot, settings, accent, avatarData, now, pulsePhase) {
  if (!snapshot?.discord?.authenticated) return renderConnection(snapshot, accent);
  if (!snapshot.channel) return frame(`${text(72, 63, "NO VOICE", 17, { fill: MUTED })}${text(72, 91, "Join a channel", 11)}`, accent);
  const member = memberForAction(kind, snapshot, settings, now);
  if (!member) {
    const slot = kind === "member-slot" ? `SLOT ${Math.max(1, Number(settings.slotIndex || 1))}` : kind === "spotlight" ? "SPOTLIGHT" : "MEMBER";
    return frame(`${iconUsers(72, 52, MUTED)}${text(72, 107, slot, 12, { fill: MUTED, spacing: 1 })}${text(72, 125, "EMPTY", 11, { fill: MUTED })}`, accent);
  }
  const speaking = Boolean(member.speaking || member.recentlySpeaking);
  const avatar = renderAvatar(member, avatarData, accent, speaking, pulsePhase, settings.showAvatar !== false, settings.fallbackInitials !== false);
  const display = settings.showDisplayName === false ? "" : truncate(member.displayName, settings.displayMode === "compact" ? 12 : 15);
  const state = member.deaf ? "DEAFENED" : member.mute ? "MUTED" : member.speaking ? "SPEAKING" : member.recentlySpeaking ? "SPOKE" : "LISTENING";
  const stateColor = member.deaf || member.mute ? DANGER : speaking ? accent : MUTED;
  return frame(`${avatar}${display ? text(72, 110, display, 13) : ""}${text(72, 128, state, 9, { fill: stateColor, spacing: 1.1 })}`, accent, { active: speaking });
}

function renderActivity(snapshot, accent, pulsePhase) {
  if (!snapshot?.discord?.authenticated) return renderConnection(snapshot, accent);
  const count = speakingCount(snapshot.members);
  const active = count > 0;
  const radius = active ? (pulsePhase ? 26 : 22) : 18;
  const color = active ? accent : MUTED;
  return frame(`<circle cx="72" cy="57" r="${radius}" fill="${color}" opacity="${active ? 0.22 : 0.1}"/><circle cx="72" cy="57" r="11" fill="${color}"/>${text(72, 109, String(count), 27, { fill: active ? accent : FG })}${text(72, 128, count === 1 ? "SPEAKING" : "SPEAKING", 9, { fill: MUTED, spacing: 1.2 })}`, accent, { active });
}

function renderCount(snapshot, accent) {
  if (!snapshot?.discord?.authenticated) return renderConnection(snapshot, accent);
  const count = snapshot.channel ? snapshot.members.length : 0;
  return frame(`${iconUsers(72, 46, accent)}${text(72, 105, String(count), 34, { fill: FG })}${text(72, 126, "IN VOICE", 10, { fill: MUTED, spacing: 1.4 })}`, accent, { active: count > 0 });
}

export function renderKey(kind, snapshot, settings = {}, options = {}) {
  const accent = normalizeAccent(settings.accent);
  const now = Number(options.now || Date.now());
  const pulsePhase = Boolean(options.pulsePhase);
  switch (kind) {
    case "status": return svgDataUri(renderStatus(snapshot, accent, settings));
    case "mute": return svgDataUri(renderToggle("mute", snapshot, accent));
    case "deafen": return svgDataUri(renderToggle("deafen", snapshot, accent));
    case "combined": return svgDataUri(renderCombined(snapshot, accent));
    case "channel": return svgDataUri(renderChannel(snapshot, accent, settings));
    case "member":
    case "member-slot":
    case "spotlight":
      return svgDataUri(renderMember(kind, snapshot, settings, accent, options.avatarData || "", now, pulsePhase));
    case "activity": return svgDataUri(renderActivity(snapshot, accent, pulsePhase));
    case "count": return svgDataUri(renderCount(snapshot, accent));
    case "connection": return svgDataUri(renderConnection(snapshot, accent));
    default: return svgDataUri(frame(`${text(72, 70, "VOICE", 20, { fill: accent })}${text(72, 96, "DECK", 20)}`, accent));
  }
}

export function dialFeedback(snapshot, selectedMember = null) {
  if (!snapshot?.discord?.authenticated) {
    const [a, b] = connectionLabel(snapshot);
    return { title: a, value: b };
  }
  if (!snapshot.channel) return { title: "VOICE", value: "Not in channel" };
  if (selectedMember) {
    const state = selectedMember.deaf ? "deafened" : selectedMember.mute ? "muted" : selectedMember.speaking ? "speaking" : "listening";
    return { title: truncate(selectedMember.displayName, 20), value: state };
  }
  return { title: truncate(snapshot.channel.name || "Voice", 20), value: `${snapshot.members.length} members` };
}
