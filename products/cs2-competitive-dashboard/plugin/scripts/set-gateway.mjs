import { access, readFile, writeFile } from "node:fs/promises";

const input = process.argv[2]?.trim();
if (!input) throw new Error("usage: node scripts/set-gateway.mjs https://your-worker.example");

const url = new URL(input);
if (url.protocol !== "https:") throw new Error("production gateway must use HTTPS");
if (url.username || url.password || url.search || url.hash) throw new Error("gateway must be a clean HTTPS origin without credentials, query, or fragment");
if (["localhost", "127.0.0.1", "::1"].includes(url.hostname)) throw new Error("production gateway cannot point to localhost");
const origin = url.origin;

const asset = "static/ui/leetify-provided-dark.svg";
await access(asset).catch(() => {
  throw new Error(`missing official unmodified Leetify attribution asset: ${asset}`);
});

const configPath = "src/providers/config.ts";
let config = await readFile(configPath, "utf8");
if (!/PRO_GATEWAY_BASE_URL\s*=\s*\"[^\"]*\"/.test(config)) throw new Error("PRO_GATEWAY_BASE_URL declaration not found");
config = config.replace(/PRO_GATEWAY_BASE_URL\s*=\s*\"[^\"]*\"/, `PRO_GATEWAY_BASE_URL = ${JSON.stringify(origin)}`);
await writeFile(configPath, config, "utf8");

const piPath = "static/ui/property-inspector.html";
let pi = await readFile(piPath, "utf8");
const textAttribution = '<div class="attribution" id="leetify-attribution">Data Provided by Leetify</div>';
const logoAttribution = '<button class="attribution attribution-logo" id="leetify-attribution" type="button" aria-label="Data Provided by Leetify"><img src="leetify-provided-dark.svg" alt="Data Provided by Leetify" /></button>';
if (pi.includes(textAttribution)) pi = pi.replace(textAttribution, logoAttribution);
if (!pi.includes("leetify-provided-dark.svg")) throw new Error("Property Inspector could not be wired to the official Leetify attribution asset");
await writeFile(piPath, pi, "utf8");

console.log(`Production gateway wired: ${origin}`);
console.log("Run npm run check && npm run validate && npm run pack before release.");
