import { mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { builds } from "./builds.mjs";

await mkdir("dist", { recursive: true });
for (const build of builds) {
  await run("streamdeck", ["pack", build.output, "--output", "dist", "--force", "--no-update-check", "--no-file-list"]);
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", shell: process.platform === "win32" });
    child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`${command} exited with ${code}`)));
    child.on("error", reject);
  });
}
