import { readdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const output = resolve(here, "..", "com.packrat.voice-deck.sdPlugin", "bin");
for (const name of await readdir(output)) {
  if (name === "plugin.js") continue;
  await rm(resolve(output, name), { recursive: true, force: true });
}
console.log("Cleaned Voice Deck bundle output");
