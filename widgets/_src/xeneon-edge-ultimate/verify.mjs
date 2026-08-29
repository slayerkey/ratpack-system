import fs from "node:fs";
import path from "node:path";

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const html = fs.readFileSync(path.join(here, "index.html"), "utf8");
const jsFiles = ["core-settings.js", "core-mode.js", "providers-sensors.js", "providers-live.js", "data-weather.js", "data-ics.js", "data-agenda.js", "data-network.js", "ui-context.js", "ui-graphs.js", "ui-drawers.js", "ui-runtime.js"];
const cssFiles = ["ultimate-foundation.css","ultimate-screens.css","ultimate-responsive-a.css","ultimate-responsive-b.css"];
const js = jsFiles.map(name => fs.readFileSync(path.join(here, name), "utf8")).join("\n");
const css = cssFiles.map(name => fs.readFileSync(path.join(here, name), "utf8")).join("\n");
const manifest = JSON.parse(fs.readFileSync(path.join(here, "..", "..", "xeneon-edge-ultimate", "manifest.json"), "utf8"));

function must(condition, message) {
  if (!condition) {
    console.error("FAIL:", message);
    process.exitCode = 1;
  } else {
    console.log("OK  :", message);
  }
}

must(manifest.author === "PackRat 🐀", "canonical PackRat author");
must(manifest.id === "com.packrat.xeneon-edge-ultimate", "stable reverse-DNS id");
must(manifest.interactive === true, "touch interaction enabled");
must(manifest.required_plugins.includes("widgetbuilder.sensorsdataprovider:Sensors:1.0"), "Sensors provider declared");
must(manifest.required_plugins.includes("widgetbuilder.fpsdataprovider:Fps:1.0"), "FPS provider declared");
must(manifest.required_plugins.includes("widgetbuilder.mediadataprovider:Media:1.0"), "Media provider declared");

const properties = [...html.matchAll(/name=["']x-icue-property["'][^>]*content=["']([^"']+)["']/g)].map(m => m[1]);
const triplet = properties.slice(properties.indexOf("textColor"), properties.indexOf("textColor") + 3);
must(JSON.stringify(triplet) === JSON.stringify(["textColor","accentColor","backgroundColor"]), "Custom Style triplet stays contiguous and ordered");

for (const id of ["screenHome","screenPerformance","screenToday","screenAmbient","performanceGraph","modeNav","drawer"]) {
  must(html.includes(`id="${id}"`), `required UI surface ${id}`);
}

for (const slot of ["s-h","s-v","m-h","m-v","l-h","l-v","xl-h","xl-v"]) {
  must(css.includes(`data-slot="${slot}"`), `responsive rules for ${slot}`);
}

must(!/<script[^>]+src=["']https?:/i.test(html), "no remote scripts");
must(!/<link[^>]+rel=["']stylesheet["'][^>]+href=["']https?:/i.test(html), "no remote stylesheets");
must(js.includes('"Sensorsdataprovider"') && js.includes('getAllSensorIds'), "sensor provider is used");
must(js.includes('plugin("Fpsdataprovider")') || js.includes('"Fpsdataprovider"'), "FPS provider is used");
must(js.includes('plugin("Mediadataprovider")') || js.includes('"Mediadataprovider"'), "media provider is used");
must(js.includes("HTTPS response timing"), "network measurement is labeled honestly");
must(!/\bICMP ping\b(?!(?: or literal packet loss))/i.test(manifest.description), "manifest does not falsely claim ICMP ping");
must(!/\b1% low\b|\bframetime\b|\balbum art\b/i.test(manifest.description), "manifest does not promise Bridge-only telemetry");

if (!process.exitCode) console.log("PASS: XENEON EDGE Ultimate static verification");
