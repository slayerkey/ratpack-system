import { spawn } from "node:child_process";
import { builds } from "./builds.mjs";

for (const build of builds) {
  await run("streamdeck", ["validate", build.output, "--no-update-check"]);
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", shell: process.platform === "win32" });
    child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`${command} exited with ${code}`)));
    child.on("error", reject);
  });
}
