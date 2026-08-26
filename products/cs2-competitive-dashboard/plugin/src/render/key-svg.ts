export type KeyTone = "default" | "good" | "warn" | "danger" | "muted";

const COLORS: Record<KeyTone, string> = {
  default: "#2BE86A",
  good: "#2BE86A",
  warn: "#F2C94C",
  danger: "#FF5A67",
  muted: "#82908A"
};

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function fitValue(value: string): number {
  const length = [...value].length;
  if (length <= 4) return 40;
  if (length <= 7) return 33;
  if (length <= 10) return 27;
  if (length <= 13) return 23;
  if (length <= 16) return 20;
  if (length <= 20) return 18;
  return 16;
}

export function renderKeySvg(label: string, value: string, tone: KeyTone = "default", subtitle?: string): string {
  const accent = COLORS[tone];
  const safeLabel = escapeXml(label.toUpperCase());
  const safeValue = escapeXml(value);
  const safeSubtitle = subtitle ? escapeXml(subtitle) : "";
  const fontSize = fitValue(value);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">
<rect width="144" height="144" rx="18" fill="#0B0F0D"/>
<rect x="10" y="10" width="124" height="124" rx="14" fill="#101713" stroke="#1D2A23" stroke-width="2"/>
<rect x="18" y="18" width="26" height="4" rx="2" fill="${accent}"/>
<text x="18" y="43" fill="#93A39B" font-family="Arial, sans-serif" font-size="12" font-weight="700" letter-spacing="1">${safeLabel}</text>
<text x="72" y="91" text-anchor="middle" fill="#F4F8F6" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="800">${safeValue}</text>
${safeSubtitle ? `<text x="72" y="116" text-anchor="middle" fill="${accent}" font-family="Arial, sans-serif" font-size="11" font-weight="700">${safeSubtitle}</text>` : ""}
</svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
