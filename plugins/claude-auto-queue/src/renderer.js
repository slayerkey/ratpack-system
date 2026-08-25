function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

const FONT = "Segoe UI,Arial,sans-serif";

function svg(body, accent = "#2BE86A") {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#171B22"/>
      <stop offset="0.55" stop-color="#101319"/>
      <stop offset="1" stop-color="#080A0E"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${accent}"/>
      <stop offset="1" stop-color="${accent}" stop-opacity="0.24"/>
    </linearGradient>
  </defs>
  <rect width="144" height="144" rx="19" fill="url(#bg)"/>
  <rect x="1" y="1" width="142" height="142" rx="18" fill="none" stroke="#29303A" stroke-width="2"/>
  <rect x="14" y="13" width="42" height="3" rx="1.5" fill="url(#accent)"/>
  <circle cx="126" cy="14.5" r="2.5" fill="${accent}"/>
  ${body}
</svg>`;
}

function elapsed(startedAt) {
  if (!startedAt) return "";
  const total = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours) return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function wrapPreview(value, maxPerLine = 18, maxLines = 2) {
  const words = String(value ?? "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (!words.length) return [];
  const lines = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length <= maxPerLine) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    line = word.length > maxPerLine ? `${word.slice(0, maxPerLine - 1)}…` : word;
    if (lines.length === maxLines) break;
  }
  if (lines.length < maxLines && line) lines.push(line);
  const consumed = lines.join(" ").replaceAll("…", "").length;
  const original = words.join(" ");
  if (lines.length === maxLines && original.length > consumed && !lines[maxLines - 1].endsWith("…")) {
    const last = lines[maxLines - 1];
    lines[maxLines - 1] = `${last.slice(0, Math.max(1, maxPerLine - 1))}…`;
  }
  return lines.slice(0, maxLines);
}

const palette = {
  working: { accent: "#2BE86A", label: "WORKING" },
  need_you: { accent: "#F3B84A", label: "NEED YOU" },
  finished: { accent: "#7CE7B1", label: "FINISHED" },
  error: { accent: "#FF5A67", label: "ERROR" },
  idle: { accent: "#7F8A99", label: "IDLE" }
};

export function renderStatus(session) {
  if (!session) {
    return svg(`
      <text x="14" y="39" fill="#8993A0" font-size="10" font-family="${FONT}" font-weight="700" letter-spacing="1">CLAUDE</text>
      <text x="14" y="73" fill="#F5F7F9" font-size="19" font-family="${FONT}" font-weight="800">NO CHAT</text>
      <text x="14" y="96" fill="#7F8895" font-size="10" font-family="${FONT}">Open Claude Code</text>
    `, "#7F8A99");
  }

  const state = session.queueLimitReached ? "need_you" : session.state || "idle";
  const meta = palette[state] ?? palette.idle;
  const timer = state === "working" ? elapsed(session.turnStartedAt) : "";
  const queue = session.queue?.length ?? 0;
  const attention = session.queueLimitReached ? "QUEUE LIMIT" : session.waitingFor;

  return svg(`
    <text x="14" y="38" fill="#8993A0" font-size="10" font-family="${FONT}" font-weight="700" letter-spacing="1">CLAUDE</text>
    <text x="14" y="70" fill="#F7F8FA" font-size="21" font-family="${FONT}" font-weight="800">${meta.label}</text>
    ${attention ? `<text x="14" y="89" fill="${meta.accent}" font-size="9" font-family="${FONT}" font-weight="700">${esc(String(attention).slice(0, 24)).toUpperCase()}</text>` : ""}
    ${timer ? `<text x="14" y="118" fill="#CBD1D9" font-size="15" font-family="${FONT}" font-weight="700">${timer}</text>` : ""}
    ${queue ? `<rect x="102" y="101" width="28" height="25" rx="12.5" fill="${meta.accent}" fill-opacity="0.12" stroke="${meta.accent}" stroke-opacity="0.42"/><text x="116" y="118" text-anchor="middle" fill="${meta.accent}" font-size="13" font-family="${FONT}" font-weight="800">+${queue}</text>` : ""}
  `, meta.accent);
}

export function renderQueuePrompt(label = "QUEUE PROMPT", feedback = null) {
  const accent = feedback?.ok === false ? "#FF5A67" : "#2BE86A";
  const title = esc(String(label || "QUEUE PROMPT").slice(0, 18)).toUpperCase();
  const middle = feedback?.text ? esc(String(feedback.text).slice(0, 18)).toUpperCase() : "QUEUE NEXT";
  return svg(`
    <text x="14" y="38" fill="#8993A0" font-size="9" font-family="${FONT}" font-weight="700" letter-spacing="1">AUTO QUEUE</text>
    <text x="14" y="73" fill="#F7F8FA" font-size="17" font-family="${FONT}" font-weight="800">${title}</text>
    <text x="14" y="99" fill="${accent}" font-size="11" font-family="${FONT}" font-weight="800">${middle}</text>
    ${feedback ? "" : `<path d="M112 104v18M103 113h18" stroke="${accent}" stroke-width="3" stroke-linecap="round"/>`}
  `, accent);
}

export function renderNext(session) {
  const next = session?.queue?.[0] ?? null;
  const count = session?.queue?.length ?? 0;
  const lines = next ? wrapPreview(next.prompt, 19, 2) : ["Queue is empty"];
  const lineOne = esc(lines[0] ?? "");
  const lineTwo = esc(lines[1] ?? "");
  return svg(`
    <text x="14" y="38" fill="#8993A0" font-size="9" font-family="${FONT}" font-weight="700" letter-spacing="1">NEXT IN QUEUE</text>
    <text x="14" y="67" fill="#F7F8FA" font-size="13" font-family="${FONT}" font-weight="800">${next ? "UP NEXT" : "EMPTY"}</text>
    <text x="14" y="89" fill="#AEB6C2" font-size="10" font-family="${FONT}" font-weight="600">${lineOne}</text>
    ${lineTwo ? `<text x="14" y="103" fill="#AEB6C2" font-size="10" font-family="${FONT}" font-weight="600">${lineTwo}</text>` : ""}
    ${count ? `<rect x="102" y="105" width="28" height="22" rx="11" fill="#2BE86A" fill-opacity="0.12"/><text x="116" y="120" text-anchor="middle" fill="#2BE86A" font-size="12" font-family="${FONT}" font-weight="800">${count}</text>` : ""}
  `, next ? "#2BE86A" : "#7F8A99");
}

export function renderControl(operation = "remove-next") {
  const labels = {
    "remove-next": ["REMOVE", "NEXT"],
    clear: ["CLEAR", "QUEUE"],
    rotate: ["MOVE NEXT", "TO END"]
  };
  const [a, b] = labels[operation] ?? labels["remove-next"];
  const accent = operation === "clear" ? "#FF5A67" : "#F3B84A";
  const glyph = operation === "clear"
    ? `<path d="M106 104h20M110 104l2 20h9l2-20M114 100h6" fill="none" stroke="${accent}" stroke-width="2.5" stroke-linecap="round"/>`
    : operation === "rotate"
      ? `<path d="M106 115a10 10 0 1 0 3-8M106 107v8h8" fill="none" stroke="${accent}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`
      : `<path d="M108 106l10 9 10-9M118 96v18" fill="none" stroke="${accent}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`;
  return svg(`
    <text x="14" y="38" fill="#8993A0" font-size="9" font-family="${FONT}" font-weight="700" letter-spacing="1">QUEUE CONTROL</text>
    <text x="14" y="74" fill="#F7F8FA" font-size="18" font-family="${FONT}" font-weight="800">${a}</text>
    <text x="14" y="98" fill="${accent}" font-size="14" font-family="${FONT}" font-weight="800">${b}</text>
    ${glyph}
  `, accent);
}

export function keyImage(markup) {
  return `data:image/svg+xml;base64,${Buffer.from(markup, "utf8").toString("base64")}`;
}
