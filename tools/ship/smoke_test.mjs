/** Local authenticated Maker Console smoke test. */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const LOG = join(ROOT, "artifacts", "playwright-smoke");
mkdirSync(LOG, { recursive: true });
const browser = await chromium.launchPersistentContext(join(ROOT, ".playwright-profile"), {
  headless: false,
  viewport: { width: 1500, height: 950 },
});
const page = browser.pages()[0] ?? (await browser.newPage());
await page.goto("https://maker.elgato.com", { waitUntil: "domcontentloaded", timeout: 45000 });
await page.waitForTimeout(6000);
const shot = join(LOG, "maker-console.png");
await page.screenshot({ path: shot });
console.log("loaded:", page.url());
console.log("title:", await page.title());
console.log("screenshot:", shot);
await browser.close();
