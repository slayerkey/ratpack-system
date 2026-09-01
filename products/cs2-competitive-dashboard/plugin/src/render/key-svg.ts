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

// Arial Bold advance widths in 1/1000 em for the glyphs these keys render.
// Character count alone is not enough: "WAITING" is seven glyphs but renders
// nearly twice as wide as "1111111" at the same size.
const ADVANCE: Record<string, number> = {
  " ": 278, "!": 333, "\"": 474, "#": 556, "$": 556, "%": 889, "&": 722, "'": 238,
  "(": 333, ")": 333, "*": 389, "+": 584, ",": 278, "-": 333, ".": 278, "/": 278,
  ":": 333, ";": 333, "<": 584, "=": 584, ">": 584, "?": 611, "@": 975,
  "[": 333, "\\": 278, "]": 333, "^": 584, "_": 556, "…": 1000,
  A: 722, B: 722, C: 722, D: 722, E: 667, F: 611, G: 778, H: 722, I: 278,
  J: 556, K: 722, L: 611, M: 833, N: 722, O: 778, P: 667, Q: 778, R: 722,
  S: 667, T: 611, U: 722, V: 667, W: 944, X: 667, Y: 667, Z: 611,
  a: 556, b: 611, c: 556, d: 611, e: 556, f: 333, g: 611, h: 611, i: 278,
  j: 278, k: 556, l: 278, m: 889, n: 611, o: 611, p: 611, q: 611, r: 389,
  s: 556, t: 333, u: 611, v: 556, w: 778, x: 556, y: 556, z: 500
};
const DIGIT_ADVANCE = 556;
const FALLBACK_ADVANCE = 722;

/** Inner key panel is 124px wide; keep a small margin so glyphs never touch the edge. */
export const VALUE_MAX_WIDTH = 116;
const VALUE_SIZES = [40, 33, 27, 23, 20, 18, 16, 14];
const ELLIPSIS = "…";

/** Approximate rendered width of a value in em units. */
export function measureEm(value: string): number {
  let total = 0;
  for (const character of value) {
    total += ADVANCE[character] ?? (character >= "0" && character <= "9" ? DIGIT_ADVANCE : FALLBACK_ADVANCE);
  }
  return total / 1000;
}

/** Largest ladder size at which the value actually fits the key. */
export function fitValue(value: string): number {
  const em = measureEm(value);
  if (em <= 0) return VALUE_SIZES[0];
  for (const size of VALUE_SIZES) {
    if (em * size <= VALUE_MAX_WIDTH) return size;
  }
  return VALUE_SIZES[VALUE_SIZES.length - 1];
}

/** Values too wide even at the smallest readable size are truncated rather than clipped. */
export function clampValue(value: string, size: number): string {
  if (measureEm(value) * size <= VALUE_MAX_WIDTH) return value;
  const characters = [...value];
  while (characters.length > 0) {
    characters.pop();
    const candidate = `${characters.join("").trimEnd()}${ELLIPSIS}`;
    if (measureEm(candidate) * size <= VALUE_MAX_WIDTH) return candidate;
  }
  return ELLIPSIS;
}

export function renderKeySvg(label: string, value: string, tone: KeyTone = "default", subtitle?: string): string {
  const accent = COLORS[tone];
  const safeLabel = escapeXml(label.toUpperCase());
  const safeValue = escapeXml(clampValue(value, fitValue(value)));
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
