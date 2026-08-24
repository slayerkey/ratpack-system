import { cp } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const source = resolve(root, "src");
const output = resolve(root, "com.packrat.discord-bridge.sdPlugin", "bin");

for (const name of ["streamkit-edge.js", "hotkeys.js"]) {
  await cp(resolve(source, name), resolve(output, name));
}

console.log("Added StreamKit Edge transport to Discord Bridge build");
