import { mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { builds } from "./builds.mjs";

await mkdir("dist", { recursive: true });
for (const build of builds) {
  await run("streamdeck", ["pack", build.output, "--output", "dist", "--force", "--no-update-check", "--no-file-list"]);
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const invocation = platformInvocation(command, args);
    const child = spawn(invocation.command, invocation.args, { stdio: "inherit", shell: false });
    child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`${command} exited with ${code}`)));
    child.on("error", reject);
  });
}

function platformInvocation(command, args) {
  if (process.platform !== "win32") return { command, args };
  const shell = process.env.ComSpec || "cmd.exe";
  const commandLine = [command, ...args].map(quoteWindowsArg).join(" ");
  return { command: shell, args: ["/d", "/s", "/c", commandLine] };
}

function quoteWindowsArg(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}
