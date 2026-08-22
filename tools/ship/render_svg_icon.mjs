import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const [src, out] = process.argv.slice(2);
if (!src || !out) throw new Error('usage: node render_svg_icon.mjs <src.svg> <out.png>');
const output = resolve(out);
mkdirSync(dirname(output), { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 288, height: 288 }, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(resolve(src)).href, { waitUntil: 'load' });
  await page.evaluate(() => {
    const svg = document.documentElement;
    if (!svg || svg.tagName.toLowerCase() !== 'svg') throw new Error('source document root is not SVG');
    svg.setAttribute('width', '288');
    svg.setAttribute('height', '288');
    svg.setAttribute('preserveAspectRatio', svg.getAttribute('preserveAspectRatio') || 'xMidYMid meet');
    svg.style.width = '288px';
    svg.style.height = '288px';
    svg.style.display = 'block';
    svg.style.background = 'transparent';
    svg.style.margin = '0';
    svg.style.padding = '0';
  });
  await page.screenshot({ path: output, omitBackground: true });
} finally {
  await browser.close();
}
console.log(`ICON PASS: ${output}`);
