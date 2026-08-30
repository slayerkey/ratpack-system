export const SPEAKER_HOLD_MS = 900;

export function clamp(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

export function safeText(value, fallback = "") {
  const text = String(value ?? "").replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();
  return text || fallback;
}

export function memberId(raw) {
  return String(raw?.user?.id || raw?.user_id || raw?.voice_state?.user_id || "");
}

export function memberDisplayName(raw) {
  return safeText(
    raw?.nick || raw?.voice_state?.nick || raw?.user?.global_name || raw?.user?.username,
    "Unknown member",
  );
}

export function memberUsername(raw) {
  const username = safeText(raw?.user?.username);
  if (!username) return "";
  const discriminator = safeText(raw?.user?.discriminator);
  return discriminator && discriminator !== "0" ? `${username}#${discriminator}` : `@${username}`;
}

export function memberVoiceState(raw) {
  const state = raw?.voice_state || raw || {};
  return {
    mute: Boolean(state.mute || state.self_mute),
    deaf: Boolean(state.deaf || state.self_deaf),
  };
}

export function avatarUrl(raw, size = 128) {
  const id = memberId(raw);
  const hash = safeText(raw?.user?.avatar);
  if (!id || !hash) return "";
  const bounded = [64, 128, 256].includes(Number(size)) ? Number(size) : 128;
  return `https://cdn.discordapp.com/avatars/${encodeURIComponent(id)}/${encodeURIComponent(hash)}.png?size=${bounded}`;
}

export function initials(value) {
  const parts = safeText(value, "?").split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return Array.from(parts[0]).slice(0, 2).join("").toUpperCase();
  return `${Array.from(parts[0])[0] || ""}${Array.from(parts.at(-1))[0] || ""}`.toUpperCase() || "?";
}

export function mergeVoiceState(existing, incoming) {
  if (!existing) return incoming || {};
  if (!incoming || typeof incoming !== "object") return existing;
  const next = { ...existing, ...incoming };
  if (existing.user || incoming.user) next.user = { ...(existing.user || {}), ...(incoming.user || {}) };
  if (existing.voice_state || incoming.voice_state) {
    next.voice_state = { ...(existing.voice_state || {}), ...(incoming.voice_state || {}) };
  }
  return next;
}

export function upsertVoiceState(list, raw) {
  const next = Array.isArray(list) ? list.slice() : [];
  const id = memberId(raw);
  if (!id) return next;
  const index = next.findIndex((entry) => memberId(entry) === id);
  if (index >= 0) next[index] = mergeVoiceState(next[index], raw);
  else next.push(raw);
  return next;
}

export function removeVoiceState(list, raw) {
  const id = memberId(raw);
  if (!id) return Array.isArray(list) ? list.slice() : [];
  return (Array.isArray(list) ? list : []).filter((entry) => memberId(entry) !== id);
}

export function normalizeMember(raw, order, speakingMeta = {}, now = Date.now()) {
  const id = memberId(raw);
  const voice = memberVoiceState(raw);
  const speaking = speakingMeta[id] || {};
  const holdUntil = Number(speaking.holdUntil || 0);
  return {
    id,
    user: raw?.user || {},
    displayName: memberDisplayName(raw),
    username: memberUsername(raw),
    avatarUrl: avatarUrl(raw),
    mute: voice.mute,
    deaf: voice.deaf,
    speaking: Boolean(speaking.active),
    recentlySpeaking: !speaking.active && holdUntil > now,
    lastSpokeAt: Number(speaking.lastStartAt || 0),
    holdUntil,
    order: Number(order) || 0,
    raw,
  };
}

export function normalizeRoster(channel, speakingMeta = {}, accountId = "", ordering = "stable", now = Date.now()) {
  const voiceStates = Array.isArray(channel?.voice_states) ? channel.voice_states : [];
  const selfId = String(accountId || "");
  const members = voiceStates.map((raw, index) => normalizeMember(raw, index, speakingMeta, now));
  return members.sort((left, right) => {
    const leftSelf = left.id && left.id === selfId ? 1 : 0;
    const rightSelf = right.id && right.id === selfId ? 1 : 0;
    if (leftSelf !== rightSelf) return rightSelf - leftSelf;
    if (ordering === "speaking-first") {
      const leftSpeak = left.speaking ? 2 : left.recentlySpeaking ? 1 : 0;
      const rightSpeak = right.speaking ? 2 : right.recentlySpeaking ? 1 : 0;
      if (leftSpeak !== rightSpeak) return rightSpeak - leftSpeak;
    }
    return left.order - right.order;
  });
}

export function pickSpotlight(members, now = Date.now()) {
  const list = Array.isArray(members) ? members : [];
  const active = list.filter((member) => member.speaking).sort((a, b) => b.lastSpokeAt - a.lastSpokeAt);
  if (active.length) return active[0];
  const held = list
    .filter((member) => member.holdUntil > now)
    .sort((a, b) => b.lastSpokeAt - a.lastSpokeAt);
  return held[0] || null;
}

export function speakingCount(members) {
  return (Array.isArray(members) ? members : []).reduce((count, member) => count + (member.speaking ? 1 : 0), 0);
}

export function normalizeAccent(value, fallback = "#2BE86A") {
  const text = String(value || "").trim();
  return /^#[0-9A-Fa-f]{6}$/.test(text) ? text.toUpperCase() : fallback;
}

export function truncate(value, max) {
  const text = safeText(value);
  const chars = Array.from(text);
  if (chars.length <= max) return text;
  return `${chars.slice(0, Math.max(1, max - 1)).join("")}…`;
}
