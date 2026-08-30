import { access, copyFile, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const sourceAsset = "static/ui/leetify-provided-dark.svg";
const proUiDir = "out/com.packrat.cs2-competitive-dashboard-pro.sdPlugin/ui";
const outputAsset = path.join(proUiDir, "leetify-provided-dark.svg");
const outputPi = path.join(proUiDir, "property-inspector.html");
const textSurface = '<div class="attribution" id="leetify-attribution">Data Provided by Leetify</div>';
const officialSurface = '<button type="button" class="attribution attribution-logo" id="leetify-attribution" aria-label="Data Provided by Leetify"><img src="leetify-provided-dark.svg" alt="Data Provided by Leetify" /></button>';

try {
  await access(sourceAsset);
} catch {
  console.log("Leetify official attribution asset not present yet; development build retains text placeholder. Final release gate will remain blocked.");
  process.exit(0);
}

await copyFile(sourceAsset, outputAsset);
const html = await readFile(outputPi, "utf8");
if (!html.includes(textSurface) && !html.includes('class="attribution attribution-logo"')) {
  throw new Error("Could not locate the Leetify attribution surface in the Pro Property Inspector");
}

if (html.includes(textSurface)) {
  await writeFile(outputPi, html.replace(textSurface, officialSurface), "utf8");
}

console.log("Official Leetify attribution asset wired into the Pro Property Inspector build.");
