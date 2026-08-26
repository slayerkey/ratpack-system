import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const repo = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(".");
const packagedEntry = process.env.RATPACK_PACKAGED_ENTRY ? path.resolve(process.env.RATPACK_PACKAGED_ENTRY) : null;
const entry = packagedEntry || path.join(repo, "widgets", "helldivers", "index.html");
if (!fs.existsSync(entry)) throw new Error(`shipping widget not found: ${entry}`);

const future = (hours) => new Date(Date.now() + hours * 3600_000).toISOString();
const campaigns = [
  { id: 201, faction: "Automaton", planet: { index: 202, name: "Vernen Wells", sector: "Hydra", health: 1000000, maxHealth: 1000000, regenPerSecond: 0, currentOwner: "Humans", biome: { name: "Highlands" }, hazards: [{ name: "Ion Storms" }], statistics: { playerCount: 12482 }, regions: [], event: { id: 7001, faction: "Automaton", health: 710000, maxHealth: 1000000, startTime: future(-2), endTime: future(4), campaignId: 201 } } },
  { id: 202, faction: "Terminids", planet: { index: 101, name: "Gacrux", sector: "Jin Xi", health: 163000, maxHealth: 1000000, regenPerSecond: 100, currentOwner: "Terminids", biome: { name: "Jungle" }, hazards: [{ name: "Acid Storms" }], statistics: { playerCount: 9200 }, regions: [] } },
  { id: 203, faction: "Illuminate", planet: { index: 303, name: "Genesis Prime", sector: "Orion", health: 1000000, maxHealth: 1000000, regenPerSecond: 25, currentOwner: "Illuminate", biome: { name: "Mesa" }, hazards: [{ name: "Meteor Storms" }], statistics: { playerCount: 4910 }, regions: [{ name: "Prosperity City", health: 520000, maxHealth: 1000000, isAvailable: true, players: 4100 }] } },
  { id: 204, faction: "Automaton", planet: { index: 404, name: "Menkent", sector: "Hydra", health: 1000000, maxHealth: 1000000, regenPerSecond: 60, currentOwner: "Automaton", biome: { name: "Desert" }, hazards: [{ name: "Fire Tornadoes" }], statistics: { playerCount: 2200 }, regions: [] } }
];
const assignment = {
  id: 9001,
  title: "Defend democracy across the galactic perimeter",
  briefing: "Deploy Helldivers to the priority fronts. Hold the defense, liberate the marked world, and eradicate enemy forces before the order expires.",
  progress: [0, 0, 1250000],
  tasks: [
    { type: 12, values: [202], valueTypes: [12] },
    { type: 11, values: [101], valueTypes: [12] },
    { type: 3, values: [2000000], valueTypes: [3] }
  ],
  expiration: future(31)
};
const responses = {
  "/api/v1/war": { now: new Date().toISOString(), factions: ["Humans", "Terminids", "Automaton", "Illuminate"], statistics: { playerCount: 34821 } },
  "/api/v1/campaigns": campaigns,
  "/api/v1/assignments": [assignment],
  "/api/v1/planets": campaigns.map((campaign) => campaign.planet)
};
const slots = [
  ["s-h", 840, 344], ["s-v", 696, 416], ["m-h", 840, 696], ["m-v", 696, 840],
  ["l-h", 1688, 696], ["l-v", 696, 1688], ["xl-h", 2536, 696], ["xl-v", 696, 2536]
];

const browser = await chromium.launch({ headless: true });
const failures = [];

for (const [slot, width, height] of slots) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });

  await page.addInitScript(() => {
    globalThis.uniqueId = "helldivers-qa";
    globalThis.refreshMinutes = 1;
    globalThis.showTicker = true;
    globalThis.textColor = "#F4F6F8";
    globalThis.accentColor = "#2BE86A";
    globalThis.backgroundColor = "#05080C";
    globalThis.tr = async (value) => value;
    try { localStorage.clear(); } catch (error) {}
  });

  await page.route("https://api.helldivers2.dev/**", async (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") {
      return route.fulfill({ status: 204, headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "X-Super-Client, X-Super-Contact",
        "Access-Control-Allow-Methods": "GET, OPTIONS"
      }});
    }
    const url = new URL(request.url());
    const payload = responses[url.pathname];
    if (!payload) return route.fulfill({ status: 404, body: "{}" });
    return route.fulfill({ status: 200, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(payload) });
  });

  await page.goto(pathToFileURL(entry).href, { waitUntil: "load" });
  await page.waitForFunction(() => document.body.getAttribute("data-connection") === "live", { timeout: 10000 });
  await page.waitForTimeout(200);

  const report = await page.evaluate(() => {
    const visible = (el) => {
      if (!el) return false;
      const style = getComputedStyle(el);
      const box = el.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && box.width > 0 && box.height > 0;
    };
    const cards = Array.from(document.querySelectorAll(".campaign-card"));
    const title = document.getElementById("orderTitle");
    const titleStyle = getComputedStyle(title);
    return {
      slot: document.body.getAttribute("data-slot"),
      overflowX: document.documentElement.scrollWidth - innerWidth,
      overflowY: document.documentElement.scrollHeight - innerHeight,
      cards: cards.length,
      visibleCards: cards.filter(visible).length,
      tickerVisible: visible(document.getElementById("ticker")),
      warVisible: visible(document.getElementById("warSummary")),
      titleFontSize: parseFloat(titleStyle.fontSize),
      titleLineHeight: parseFloat(titleStyle.lineHeight)
    };
  });

  if (report.slot !== slot) failures.push(`${slot}: selected ${report.slot}`);
  if (report.overflowX > 0.5 || report.overflowY > 0.5) failures.push(`${slot}: overflow ${report.overflowX}x${report.overflowY}`);
  if (report.cards !== 4) failures.push(`${slot}: expected four fixture campaign cards`);
  if (slot.startsWith("s-") && report.visibleCards !== 1) failures.push(`${slot}: Small must show one campaign, saw ${report.visibleCards}`);
  if (slot.startsWith("m-") && report.visibleCards > 2) failures.push(`${slot}: Medium shows too many campaigns`);
  if (!report.warVisible) failures.push(`${slot}: war summary hidden`);
  if (!slot.startsWith("s-") && !report.tickerVisible) failures.push(`${slot}: war feed hidden`);
  if (slot.startsWith("s-") && report.tickerVisible) failures.push(`${slot}: war feed should be hidden`);
  if (report.titleLineHeight < report.titleFontSize * 0.99) failures.push(`${slot}: unsafe Major Order title line height`);

  await page.locator(".campaign-card").first().click();
  if (!(await page.locator("#campaignDetail").isVisible())) failures.push(`${slot}: planet detail did not open`);
  await page.locator("#campaignDetail").click();
  await page.locator("#majorOrder").click();
  if ((await page.getAttribute("body", "data-order-mode")) !== "objectives") failures.push(`${slot}: Major Order objective toggle failed`);
  if (errors.length) failures.push(`${slot}: runtime errors: ${errors.join(" | ")}`);
  await page.close();
}

await browser.close();
if (failures.length) {
  console.error("HELLDIVERS QA FAIL");
  failures.forEach((failure) => console.error(failure));
  process.exit(1);
}
console.log("HELLDIVERS QA PASS: eight layouts, CORS preflight, interactions, overflow, runtime, and title line-height checks passed");
