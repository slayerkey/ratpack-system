#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";

const baseUrl = process.argv[2] || "http://127.0.0.1:8080/";
const slug = process.argv[3];
const outDir = process.argv[4] || "artifacts/icue-runner";

if (!slug) {
  console.error("usage: node tools/xeneon/icue-runner-smoke.mjs <runner-url> <slug> [output-dir]");
  process.exit(2);
}

fs.mkdirSync(outDir, { recursive: true });

const target = {
  textColor: "#FFF3D6",
  accentColor: "#FF274D",
  backgroundColor: "#18100B",
};
const styleTriplet = Object.keys(target);

function normalize(value) {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, "");
}

function containsValue(object, expected) {
  const wanted = normalize(expected);
  return Object.values(object || {}).some((value) => normalize(value) === wanted);
}

const report = {
  schema_version: 2,
  runner: "Corsair-Labs/iCUE-widget-runner-windows",
  runner_url: baseUrl,
  slug,
  fidelity: {
    property_injection: null,
    note: "Corsair Labs runner is a compatibility host. RatPack keeps a separate lexical-binding smoke because real iCUE review exposed behavior that window-property shims can hide.",
  },
  initial: null,
  updated: null,
  style_tested: false,
  passed: false,
};

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1688, height: 900 } });
const page = await context.newPage();
const pageErrors = [];
const consoleErrors = [];
page.on("pageerror", (error) => pageErrors.push(String(error)));
page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});

async function widgetFrame() {
  const handle = await page.locator("#viewer").elementHandle();
  if (!handle) throw new Error("runner viewer iframe not found");
  const frame = await handle.contentFrame();
  if (!frame) throw new Error("runner viewer iframe has no content frame");
  return frame;
}

async function snapshot(frame) {
  return frame.evaluate(() => {
    const root = document.documentElement;
    const css = getComputedStyle(root);
    const vars = {};
    for (const name of ["--text", "--accent", "--bg", "--background", "--graph", "--graph-color"]) {
      const value = root.style.getPropertyValue(name) || css.getPropertyValue(name);
      if (String(value || "").trim()) vars[name] = String(value).trim();
    }
    const declared = [...document.querySelectorAll('meta[name="x-icue-property"]')]
      .map((node) => String(node.getAttribute("content") || "").trim())
      .filter(Boolean);
    return {
      declared,
      hasOwnTextColor: Object.prototype.hasOwnProperty.call(globalThis, "textColor"),
      hasOwnAccentColor: Object.prototype.hasOwnProperty.call(globalThis, "accentColor"),
      hasOwnBackgroundColor: Object.prototype.hasOwnProperty.call(globalThis, "backgroundColor"),
      textBinding: globalThis.textColor,
      accentBinding: globalThis.accentColor,
      backgroundBinding: globalThis.backgroundColor,
      bridge: globalThis.__ratpackIcueBindingBridge || null,
      customProperties: vars,
      bodyBackground: document.body ? getComputedStyle(document.body).backgroundColor : "",
      bodyColor: document.body ? getComputedStyle(document.body).color : "",
      bodyState: document.body ? {
        slot: document.body.getAttribute("data-slot"),
        state: document.body.getAttribute("data-state") || document.body.getAttribute("data-panel-state") || document.body.getAttribute("data-session-state"),
        edition: document.body.getAttribute("data-edition"),
      } : null,
    };
  });
}

let exitCode = 0;
try {
  const url = new URL(baseUrl);
  url.searchParams.set("widget", slug);
  await page.goto(url.href, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForSelector("#viewer", { timeout: 30_000 });
  await page.waitForFunction(
    (expectedSlug) => {
      const title = document.getElementById("widgetTitle")?.textContent || "";
      const viewer = document.getElementById("viewer");
      return !!viewer && !!title && title !== "No widget loaded" && typeof window.getWidgetById === "function" && !!window.getWidgetById(`disk:${expectedSlug}`);
    },
    slug,
    { timeout: 30_000 },
  );
  await page.waitForTimeout(750);

  let frame = await widgetFrame();
  await frame.waitForLoadState("domcontentloaded");
  report.initial = await snapshot(frame);
  report.fidelity.property_injection = report.initial.hasOwnTextColor && report.initial.hasOwnAccentColor && report.initial.hasOwnBackgroundColor
    ? "window-object-properties"
    : "non-window-binding";

  await page.screenshot({ path: path.join(outDir, `${slug}-runner-before.png`), fullPage: true });

  const hasStyleTriplet = styleTriplet.every((name) => report.initial.declared.includes(name));
  if (hasStyleTriplet) {
    report.style_tested = true;
    await page.evaluate(({ slug: widgetSlug, next }) => {
      const widget = window.getWidgetById(`disk:${widgetSlug}`);
      if (!widget) throw new Error(`runner widget not found: ${widgetSlug}`);
      for (const [name, value] of Object.entries(next)) window.saveWidgetSetting(widget, name, value);
      window.applyWidgetSettings(widget);
    }, { slug, next: target });
    await page.waitForTimeout(750);

    frame = await widgetFrame();
    report.updated = await snapshot(frame);

    for (const [key, expected] of [
      ["textBinding", target.textColor],
      ["accentBinding", target.accentColor],
      ["backgroundBinding", target.backgroundColor],
    ]) {
      if (normalize(report.updated[key]) !== normalize(expected)) {
        throw new Error(`runner ${key} mismatch: ${report.updated[key]} != ${expected}`);
      }
    }

    if (!containsValue(report.updated.customProperties, target.textColor)) {
      throw new Error(`widget did not apply runner textColor to a known CSS custom property: ${JSON.stringify(report.updated.customProperties)}`);
    }
    if (!containsValue(report.updated.customProperties, target.accentColor)) {
      throw new Error(`widget did not apply runner accentColor to a known CSS custom property: ${JSON.stringify(report.updated.customProperties)}`);
    }
    if (!containsValue(report.updated.customProperties, target.backgroundColor)) {
      throw new Error(`widget did not apply runner backgroundColor to a known CSS custom property: ${JSON.stringify(report.updated.customProperties)}`);
    }

    if (!report.updated.bridge || Number(report.updated.bridge.version) < 2) {
      throw new Error("packaged widget is not using the hardened RatPack iCUE binding bridge");
    }
  } else {
    report.updated = report.initial;
    report.style_skip_reason = "widget does not declare the complete XENEON Custom Style triplet";
  }

  if (!report.initial.bodyState) throw new Error("runner loaded widget without a document body state snapshot");
  if (pageErrors.length) throw new Error(`runner page errors: ${JSON.stringify(pageErrors)}`);
  await page.screenshot({ path: path.join(outDir, `${slug}-runner-after.png`), fullPage: true });
  report.passed = true;
} catch (error) {
  report.error = String(error?.stack || error);
  exitCode = 1;
} finally {
  report.pageErrors = pageErrors;
  report.consoleErrors = consoleErrors;
  fs.writeFileSync(path.join(outDir, `${slug}-runner-result.json`), JSON.stringify(report, null, 2) + "\n");
  await browser.close();
}

console.log(JSON.stringify(report, null, 2));
process.exit(exitCode);