function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function svg(body, accent = "#2BE86A") {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#171b22"/>
      <stop offset="1" stop-color="#090b0f"/>
    </linearGradient>
  </defs>
  <rect width="144" height="144" rx="18" fill="url(#bg)"/>
  <rect x="1" y="1" width="142" height="142" rx="17" fill="none" stroke="#2b313b" stroke-width="2"/>
  <rect x="14" y="13" width="22" height="3" rx="1.5" fill="${accent}"/>
  ${body}
</svg>`;
}

function elapsed(startedAt) {
  if (!startedAt) return "";
  const total = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

const palette = {
  working: { accent: "#2BE86A", label: "WORKING" },
  need_you: { accent: "#F3B84A", label: "NEED YOU" },
  finished: { accent: "#7CE7B1", label: "FINISHED" },
  error: { accent: "#FF5A67", label: "ERROR" },
  idle: { accent: "#7F8A99", label: "IDLE" }
};

export function renderStatus(session, projectLabel = "Claude Code") {
  if (!session) {
    return svg(`
      <text x="14" y="38" fill="#8f98a6" font-size="12" font-family="Arial, sans-serif" font-weight="700">CLAUDE</text>
      <text x="14" y="75" fill="#f4f6f8" font-size="19" font-family="Arial, sans-serif" font-weight="800">NO SESSION</text>
      <text x="14" y="97" fill="#7f8895" font-size="10" font-family="Arial, sans-serif">Open Claude Code</text>
    `, "#7F8A99");
  }

  const state = session.queueLimitReached ? "need_you" : session.state || "idle";
  const meta = palette[state] ?? palette.idle;
  const timer = state === "working" ? elapsed(session.turnStartedAt) : "";
  const queue = session.queue?.length ?? 0;
  const attention = session.queueLimitReached ? "QUEUE LIMIT" : session.waitingFor;
  const project = esc(String(projectLabel).slice(0, 20));

  return svg(`
    <text x="14" y="35" fill="#8f98a6" font-size="10" font-family="Arial, sans-serif" font-weight="700">CLAUDE · ${project}</text>
    <text x="14" y="68" fill="#f7f8fa" font-size="20" font-family="Arial, sans-serif" font-weight="800">${meta.label}</text>
    ${attention ? `<text x="14" y="86" fill="${meta.accent}" font-size="9" font-family="Arial, sans-serif" font-weight="700">${esc(String(attention).slice(0, 24)).toUpperCase()}</text>` : ""}
    ${timer ? `<text x="14" y="112" fill="#cbd1d9" font-size="15" font-family="Arial, sans-serif" font-weight="700">${timer}</text>` : ""}
    ${queue ? `<text x="111" y="116" text-anchor="end" fill="${meta.accent}" font-size="17" font-family="Arial, sans-serif" font-weight="800">+${queue}</text>` : ""}
  `, meta.accent);
}

export function renderQueuePrompt(label = "QUEUE PROMPT", feedback = null) {
  const accent = feedback?.ok === false ? "#FF5A67" : "#2BE86A";
  const title = esc(String(label || "QUEUE PROMPT").slice(0, 18)).toUpperCase();
  const middle = feedback?.text ? esc(String(feedback.text).slice(0, 18)).toUpperCase() : "ADD NEXT";
  return svg(`
    <text x="14" y="38" fill="#8f98a6" font-size="10" font-family="Arial, sans-serif" font-weight="700">AUTO QUEUE</text>
    <text x="14" y="70" fill="#f7f8fa" font-size="17" font-family="Arial, sans-serif" font-weight="800">${title}</text>
    <text x="14" y="95" fill="${accent}" font-size="11" font-family="Arial, sans-serif" font-weight="800">${middle}</text>
  `, accent);
}

export function renderNext(session) {
  const next = session?.queue?.[0] ?? null;
  const count = session?.queue?.length ?? 0;
  const preview = next ? esc(next.prompt.slice(0, 36)) : "Queue is empty";
  return svg(`
    <text x="14" y="38" fill="#8f98a6" font-size="10" font-family="Arial, sans-serif" font-weight="700">NEXT</text>
    <text x="14" y="67" fill="#f7f8fa" font-size="13" font-family="Arial, sans-serif" font-weight="800">${next ? "UP NEXT" : "EMPTY"}</text>
    <foreignObject x="14" y="76" width="116" height="42">
      <div xmlns="http://www.w3.org/1999/xhtml" style="font:700 10px Arial,sans-serif;color:#aeb6c2;line-height:1.25;overflow:hidden">${preview}</div>
    </foreignObject>
    ${count ? `<text x="114" y="125" text-anchor="end" fill="#2BE86A" font-size="14" font-family="Arial, sans-serif" font-weight="800">+${count}</text>` : ""}
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
  return svg(`
    <text x="14" y="38" fill="#8f98a6" font-size="10" font-family="Arial, sans-serif" font-weight="700">QUEUE CONTROL</text>
    <text x="14" y="73" fill="#f7f8fa" font-size="18" font-family="Arial, sans-serif" font-weight="800">${a}</text>
    <text x="14" y="96" fill="${accent}" font-size="14" font-family="Arial, sans-serif" font-weight="800">${b}</text>
  `, accent);
}

export function keyImage(markup) {
  return `data:image/svg+xml;base64,${Buffer.from(markup, "utf8").toString("base64")}`;
}
