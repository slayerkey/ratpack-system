import { spawn } from "node:child_process";

const VK = { CTRL: 0x11, SHIFT: 0x10, M: 0x4d, D: 0x44 };
const KEYUP = 0x0002;

export function discordShortcutScript(kind) {
  const key = kind === "deafen" ? VK.D : VK.M;
  return `$sig='[DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);'; Add-Type -MemberDefinition $sig -Name Native -Namespace PackRat; [PackRat.Native]::keybd_event(${VK.CTRL},0,0,[UIntPtr]::Zero); [PackRat.Native]::keybd_event(${VK.SHIFT},0,0,[UIntPtr]::Zero); [PackRat.Native]::keybd_event(${key},0,0,[UIntPtr]::Zero); Start-Sleep -Milliseconds 30; [PackRat.Native]::keybd_event(${key},0,${KEYUP},[UIntPtr]::Zero); [PackRat.Native]::keybd_event(${VK.SHIFT},0,${KEYUP},[UIntPtr]::Zero); [PackRat.Native]::keybd_event(${VK.CTRL},0,${KEYUP},[UIntPtr]::Zero);`;
}

export function sendDiscordShortcut(kind) {
  if (process.platform !== "win32") return Promise.reject(new Error("Discord shortcuts require Windows"));
  if (kind !== "mute" && kind !== "deafen") return Promise.reject(new Error(`Unknown Discord shortcut: ${kind}`));
  return new Promise((resolve, reject) => {
    const child = spawn("powershell.exe", [
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      discordShortcutScript(kind),
    ], { windowsHide: true, stdio: "ignore" });
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolve(true) : reject(new Error(`Discord shortcut helper exited ${code}`)));
  });
}
