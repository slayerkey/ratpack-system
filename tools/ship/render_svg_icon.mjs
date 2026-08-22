import { chromium } from 'playwright';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const [src, out] = process.argv.slice(2);
if (!src || !out) throw new Error('usage: node render_svg_icon.mjs <src.svg> <out.png>');
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 288, height: 288 }, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(resolve(src)).href);
await page.evaluate(() => {
  document.documentElement.style.background = 'transparent';
  document.body.style.margin = '0';
  const svg = document.querySelector('svg');
  if (svg) {
    svg.setAttribute('width', '288');
    svg.setAttribute('height', '288');
    svg.style.width = '288px';
    svg.style.height = '288px';
  }
});
await page.screenshot({ path: out, omitBackground: true });
await browser.close();
console.log(`ICON PASS: ${out}`);
