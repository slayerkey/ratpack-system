"use strict";
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFile } = require("child_process");

const PLUGIN_UUID = "com.packrat.stream-deck-ultimate-bundle";
const ACTION = {
  APP: `${PLUGIN_UUID}.smart-app`,
  WORKSPACE: `${PLUGIN_UUID}.workspace`,
  WINDOW: `${PLUGIN_UUID}.window`,
  CLIPBOARD: `${PLUGIN_UUID}.clipboard`,
  CAPTURE: `${PLUGIN_UUID}.capture`,
  MEDIA: `${PLUGIN_UUID}.media`
};

const args = process.argv.slice(2);
function arg(name) { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : ""; }
const port = arg("-port");
const pluginUUID = arg("-pluginUUID") || PLUGIN_UUID;
const registerEvent = arg("-registerEvent") || "registerPlugin";

const stateDir = path.join(
  process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"),
  "PackRat",
  "StreamDeckUltimateBundle"
);
const historyPath = path.join(stateDir, "clipboard.json");
const logPath = path.join(stateDir, "ultimate-bundle.log");
fs.mkdirSync(stateDir, { recursive: true });

function log(msg) {
  try { fs.appendFileSync(logPath, `${new Date().toISOString()} ${msg}\n`); } catch {}
}
function psQuote(s) { return `'${String(s || "").replace(/'/g, "''")}'`; }
function runPS(script, timeout = 12000) {
  return new Promise((resolve, reject) => execFile(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script],
    { windowsHide: true, timeout, maxBuffer: 1024 * 1024 },
    (e, out, err) => e
      ? reject(new Error((err || e.message || "PowerShell failed").trim()))
      : resolve(String(out || "").trim())
  ));
}

let ws;
function send(obj) { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj)); }
function setTitle(ctx, title) { send({ event: "setTitle", context: ctx, payload: { title: String(title || ""), target: 0 } }); }
const instances = new Map();
const lastTitles = new Map();
function titleOnce(ctx, title) {
  if (lastTitles.get(ctx) !== title) {
    lastTitles.set(ctx, title);
    setTitle(ctx, title);
  }
}
function restoreTitleSoon(ctx, inst, ms = 850) {
  setTimeout(() => { if (instances.has(ctx)) render(ctx, inst); }, ms);
}
function flash(ctx, inst, title, ms = 850) {
  titleOnce(ctx, title);
  restoreTitleSoon(ctx, inst, ms);
}
function fail(ctx, inst, message, title = "FAILED") {
  log(`action failure ${inst.action}: ${message}`);
  flash(ctx, inst, title, 1400);
}

function candidateList(role) {
  const pf = process.env.ProgramFiles || "C:\\Program Files";
  const pfx = process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";
  const local = process.env.LOCALAPPDATA || "";
  const roaming = process.env.APPDATA || "";

  if (role === "browser") return [
    { path: path.join(pf, "Google", "Chrome", "Application", "chrome.exe"), processName: "chrome", label: "CHROME" },
    { path: path.join(pfx, "Google", "Chrome", "Application", "chrome.exe"), processName: "chrome", label: "CHROME" },
    { path: path.join(local, "Google", "Chrome", "Application", "chrome.exe"), processName: "chrome", label: "CHROME" },
    { path: path.join(pf, "Microsoft", "Edge", "Application", "msedge.exe"), processName: "msedge", label: "EDGE" },
    { path: path.join(pfx, "Microsoft", "Edge", "Application", "msedge.exe"), processName: "msedge", label: "EDGE" },
    { path: path.join(local, "Microsoft", "Edge", "Application", "msedge.exe"), processName: "msedge", label: "EDGE" },
    { path: path.join(pf, "Mozilla Firefox", "firefox.exe"), processName: "firefox", label: "FIREFOX" },
    { path: path.join(pfx, "Mozilla Firefox", "firefox.exe"), processName: "firefox", label: "FIREFOX" },
    { path: path.join(local, "BraveSoftware", "Brave-Browser", "Application", "brave.exe"), processName: "brave", label: "BRAVE" },
    { path: path.join(pf, "BraveSoftware", "Brave-Browser", "Application", "brave.exe"), processName: "brave", label: "BRAVE" },
    { path: path.join(local, "Programs", "Opera", "opera.exe"), processName: "opera", label: "OPERA" }
  ];

  if (role === "chat") return [
    { path: path.join(local, "Discord", "Update.exe"), args: ["--processStart", "Discord.exe"], processName: "Discord", label: "DISCORD" },
    { path: path.join(local, "slack", "slack.exe"), processName: "slack", label: "SLACK" },
    { path: path.join(local, "Microsoft", "WindowsApps", "ms-teams.exe"), processName: "ms-teams", label: "TEAMS" }
  ];

  if (role === "music") return [
    { path: path.join(roaming, "Spotify", "Spotify.exe"), processName: "Spotify", label: "SPOTIFY" },
    { path: path.join(local, "Microsoft", "WindowsApps", "Spotify.exe"), processName: "Spotify", label: "SPOTIFY" }
  ];

  return [];
}

function resolveTarget(tokenOrPath, role) {
  const roleName = (role || "").replace(/^@/, "");
  const token = String(tokenOrPath || "").trim();
  const effective = token.startsWith("@") ? token.slice(1) : roleName;

  if (["browser", "chat", "music"].includes(effective)) {
    const found = candidateList(effective).find(x => x.path && fs.existsSync(x.path));
    if (found) return found;
    if (effective === "browser") return { shellUrl: "https://www.google.com", processName: "", label: "BROWSER" };
    return null;
  }

  if (token && fs.existsSync(token)) {
    return {
      path: token,
      processName: path.basename(token, path.extname(token)),
      label: path.basename(token, path.extname(token)).toUpperCase()
    };
  }
  return null;
}

async function focusOrLaunch(target) {
  if (!target) throw new Error("No installed app found");
  if (target.shellUrl) {
    await runPS(`Start-Process ${psQuote(target.shellUrl)}; 'OPENED'`);
    return "OPENED";
  }

  const argsText = (target.args || []).map(psQuote).join(",");
  const startArgs = target.args && target.args.length ? ` -ArgumentList @(${argsText})` : "";
  const script = `
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class PRWin {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr h,int n);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h,out uint p);
}
'@;
$p=Get-Process -Name ${psQuote(target.processName)} -ErrorAction SilentlyContinue | Where-Object {$_.MainWindowHandle -ne 0} | Select-Object -First 1;
if($p){
  $fg=[PRWin]::GetForegroundWindow(); $pidNow=0; [PRWin]::GetWindowThreadProcessId($fg,[ref]$pidNow)|Out-Null;
  if($pidNow -eq $p.Id){ 'ACTIVE'; exit 0 }
  [PRWin]::ShowWindowAsync($p.MainWindowHandle,9)|Out-Null;
  $shell=New-Object -ComObject WScript.Shell;
  $activated=$shell.AppActivate($p.Id);
  if(-not $activated){ [PRWin]::SetForegroundWindow($p.MainWindowHandle)|Out-Null }
  'FOCUSED'
}else{
  Start-Process -FilePath ${psQuote(target.path)}${startArgs};
  'OPENED'
}`;
  return await runPS(script);
}

async function waitForWindow(target, timeoutMs = 7000) {
  if (!target || !target.processName) return false;
  const script = `
$deadline=(Get-Date).AddMilliseconds(${timeoutMs});
do {
  $p=Get-Process -Name ${psQuote(target.processName)} -ErrorAction SilentlyContinue | Where-Object {$_.MainWindowHandle -ne 0} | Select-Object -First 1;
  if($p){ 'READY'; exit 0 }
  Start-Sleep -Milliseconds 180
} while((Get-Date) -lt $deadline)
'WAIT_TIMEOUT'`;
  return (await runPS(script, timeoutMs + 2500)) === "READY";
}

async function moveProcess(target, mode) {
  if (!target || !target.processName) return;
  const script = `Add-Type -AssemblyName System.Windows.Forms; Add-Type @'
using System; using System.Runtime.InteropServices; public static class PRMove { [DllImport("user32.dll")] public static extern bool MoveWindow(IntPtr h,int x,int y,int w,int he,bool r); [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr h,int n); }
'@; $p=Get-Process -Name ${psQuote(target.processName)} -ErrorAction SilentlyContinue | Where-Object {$_.MainWindowHandle -ne 0} | Select-Object -First 1; if(!$p){exit 0}; $h=$p.MainWindowHandle; [PRMove]::ShowWindowAsync($h,9)|Out-Null; $a=[System.Windows.Forms.Screen]::FromHandle($h).WorkingArea; $m=${psQuote(mode)}; if($m -eq 'left'){[PRMove]::MoveWindow($h,$a.X,$a.Y,[int]($a.Width/2),$a.Height,$true)|Out-Null}; if($m -eq 'topright'){[PRMove]::MoveWindow($h,$a.X+[int]($a.Width/2),$a.Y,[int]($a.Width/2),[int]($a.Height/2),$true)|Out-Null}; if($m -eq 'bottomright'){[PRMove]::MoveWindow($h,$a.X+[int]($a.Width/2),$a.Y+[int]($a.Height/2),[int]($a.Width/2),[int]($a.Height/2),$true)|Out-Null}`;
  await runPS(script);
}

async function activeWindow(mode) {
  const script = `Add-Type -AssemblyName System.Windows.Forms; Add-Type @'
using System; using System.Runtime.InteropServices; public static class PRW { [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow(); [DllImport("user32.dll")] public static extern bool MoveWindow(IntPtr h,int x,int y,int w,int he,bool r); [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr h,int n); [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h,out RECT r); public struct RECT { public int L,T,R,B; } }
'@; $h=[PRW]::GetForegroundWindow(); if($h -eq [IntPtr]::Zero){throw 'No active window'}; $screen=[System.Windows.Forms.Screen]::FromHandle($h); $a=$screen.WorkingArea; $m=${psQuote(mode)}; if($m -eq 'left'){[PRW]::ShowWindowAsync($h,9)|Out-Null;[PRW]::MoveWindow($h,$a.X,$a.Y,[int]($a.Width/2),$a.Height,$true)|Out-Null}; if($m -eq 'right'){[PRW]::ShowWindowAsync($h,9)|Out-Null;[PRW]::MoveWindow($h,$a.X+[int]($a.Width/2),$a.Y,[int]($a.Width/2),$a.Height,$true)|Out-Null}; if($m -eq 'maximize'){[PRW]::ShowWindowAsync($h,3)|Out-Null}; if($m -eq 'next-monitor'){ $screens=[System.Windows.Forms.Screen]::AllScreens; if($screens.Count -gt 1){ $idx=0; for($i=0;$i -lt $screens.Count;$i++){if($screens[$i].DeviceName -eq $screen.DeviceName){$idx=$i}}; $t=$screens[($idx+1)%$screens.Count].WorkingArea; $r=New-Object PRW+RECT; [PRW]::GetWindowRect($h,[ref]$r)|Out-Null; $ww=[Math]::Min($r.R-$r.L,$t.Width); $hh=[Math]::Min($r.B-$r.T,$t.Height); $rx=($r.L-$a.X)/[Math]::Max(1,$a.Width); $ry=($r.T-$a.Y)/[Math]::Max(1,$a.Height); $x=$t.X+[int]($rx*$t.Width);$y=$t.Y+[int]($ry*$t.Height); [PRW]::ShowWindowAsync($h,9)|Out-Null;[PRW]::MoveWindow($h,$x,$y,$ww,$hh,$true)|Out-Null } }`;
  await runPS(script);
}

async function mediaControl(mode) {
  const vk = { "mute": 173, "volume-down": 174, "volume-up": 175, "play-pause": 179 }[mode] || 173;
  const script = `Add-Type @'
using System; using System.Runtime.InteropServices; public static class PRKeys { [DllImport("user32.dll")] public static extern void keybd_event(byte v,byte s,uint f,UIntPtr e); }
'@; [PRKeys]::keybd_event(${vk},0,0,[UIntPtr]::Zero); [PRKeys]::keybd_event(${vk},0,2,[UIntPtr]::Zero)`;
  await runPS(script);
}
async function captureRegion() { await runPS(`Start-Process 'ms-screenclip:'`); }

let clipboardHistory = [];
try {
  const v = JSON.parse(fs.readFileSync(historyPath, "utf8"));
  if (Array.isArray(v)) clipboardHistory = v.filter(x => typeof x === "string").slice(0, 4);
} catch {}
let clipboardTimer = null;
let lastClipboard = "";
function saveHistory() { try { fs.writeFileSync(historyPath, JSON.stringify(clipboardHistory, null, 2)); } catch {} }
function visibleClipboard() { return [...instances.values()].some(x => x.action === ACTION.CLIPBOARD); }
async function readClipboardText() {
  return (await runPS(`$v=Get-Clipboard -Raw -ErrorAction SilentlyContinue; if($v -is [string]){$v}`, 5000)).replace(/\r\n/g, "\n").trimEnd();
}
async function pollClipboard() {
  if (!visibleClipboard()) return;
  try {
    const txt = await readClipboardText();
    if (txt && txt !== lastClipboard) {
      lastClipboard = txt;
      clipboardHistory = [txt, ...clipboardHistory.filter(x => x !== txt)].slice(0, 4);
      saveHistory();
    }
  } catch (e) { log(`clipboard poll: ${e.message}`); }
}
function startClipboard() {
  if (!clipboardTimer) {
    clipboardTimer = setInterval(pollClipboard, 900);
    setTimeout(pollClipboard, 100);
  }
}
async function pasteClipboard(slot) {
  if (!clipboardHistory[slot - 1]) await pollClipboard();
  const text = clipboardHistory[slot - 1];
  if (!text) throw new Error("Clipboard slot is empty");
  const p = path.join(stateDir, "paste.txt");
  fs.writeFileSync(p, text, "utf8");
  const script = `$v=Get-Content -LiteralPath ${psQuote(p)} -Raw; Set-Clipboard -Value $v; Start-Sleep -Milliseconds 80; $shell=New-Object -ComObject WScript.Shell; $shell.SendKeys('^v')`;
  await runPS(script);
  lastClipboard = text;
}

function render(ctx, inst) {
  const s = inst.settings || {};
  if (inst.action === ACTION.APP) {
    const t = resolveTarget(s.path, s.role || "browser");
    titleOnce(ctx, (s.label || t?.label || String(s.role || "APP").toUpperCase()).slice(0, 12));
  } else if (inst.action === ACTION.WORKSPACE) {
    titleOnce(ctx, (s.label || "WORK").slice(0, 12));
  } else if (inst.action === ACTION.WINDOW) {
    const m = s.mode || "left";
    titleOnce(ctx, ({ left: "LEFT", right: "RIGHT", maximize: "MAX", "next-monitor": "NEXT\nSCREEN" }[m] || "WINDOW"));
  } else if (inst.action === ACTION.CLIPBOARD) {
    const slot = Math.max(1, Math.min(4, Number(s.slot || 1)));
    titleOnce(ctx, `CLIP ${slot}`);
    startClipboard();
  } else if (inst.action === ACTION.CAPTURE) {
    titleOnce(ctx, "CAPTURE");
  } else if (inst.action === ACTION.MEDIA) {
    const m = s.mode || "mute";
    titleOnce(ctx, ({ mute: "MUTE", "volume-down": "VOL −", "volume-up": "VOL +", "play-pause": "PLAY" }[m] || "MEDIA"));
  }
}

async function execute(ctx, inst) {
  const s = inst.settings || {};
  try {
    if (inst.action === ACTION.APP) {
      const t = resolveTarget(s.path, s.role || "browser");
      const result = await focusOrLaunch(t);
      flash(ctx, inst, result === "ACTIVE" ? "ACTIVE" : result === "FOCUSED" ? "FOCUS" : "OPEN", 650);
    } else if (inst.action === ACTION.WORKSPACE) {
      const raw = String(s.apps || "@browser\n@chat\n@music").split(/\r?\n/).map(x => x.trim()).filter(Boolean).slice(0, 3);
      const targets = raw.map(x => resolveTarget(x, x.startsWith("@") ? x.slice(1) : "")).filter(Boolean);
      if (!targets.length) throw new Error("No workspace apps found");
      titleOnce(ctx, "START");
      for (const t of targets) {
        try {
          await focusOrLaunch(t);
          await waitForWindow(t, 6500);
        } catch (e) { log(`workspace launch ${t.label || t.path}: ${e.message}`); }
      }
      const movable = targets.filter(t => t.processName);
      const modes = movable.length === 1 ? ["left"] : movable.length === 2 ? ["left", "topright"] : ["left", "topright", "bottomright"];
      for (let i = 0; i < movable.length; i++) {
        try { await moveProcess(movable[i], modes[i]); } catch (e) { log(`workspace move ${movable[i].label}: ${e.message}`); }
      }
      flash(ctx, inst, "READY", 900);
    } else if (inst.action === ACTION.WINDOW) {
      await activeWindow(s.mode || "left");
      flash(ctx, inst, "DONE", 450);
    } else if (inst.action === ACTION.CLIPBOARD) {
      const slot = Math.max(1, Math.min(4, Number(s.slot || 1)));
      await pasteClipboard(slot);
      flash(ctx, inst, "PASTED", 650);
    } else if (inst.action === ACTION.CAPTURE) {
      await captureRegion();
    } else if (inst.action === ACTION.MEDIA) {
      await mediaControl(s.mode || "mute");
    }
  } catch (e) {
    const message = e && e.message ? e.message : String(e);
    if (/clipboard slot is empty/i.test(message)) fail(ctx, inst, message, "EMPTY");
    else if (/no installed app/i.test(message)) fail(ctx, inst, message, "NOT FOUND");
    else fail(ctx, inst, message, "FAILED");
  }
}

if (!port) { log("missing -port argument"); process.exit(1); }
try { ws = new WebSocket(`ws://127.0.0.1:${port}`); }
catch (e) { log(`websocket create failed: ${e.message}`); process.exit(1); }

ws.addEventListener("open", () => {
  send({ event: registerEvent, uuid: pluginUUID });
  log("connected");
});
ws.addEventListener("message", ev => {
  let m;
  try { m = JSON.parse(String(ev.data)); } catch { return; }
  const ctx = m.context;
  if (m.event === "willAppear" || m.event === "didReceiveSettings") {
    const inst = { action: m.action, settings: (m.payload && m.payload.settings) || {}, device: m.device };
    instances.set(ctx, inst);
    render(ctx, inst);
  } else if (m.event === "willDisappear") {
    instances.delete(ctx);
    lastTitles.delete(ctx);
  } else if (m.event === "keyUp") {
    const inst = instances.get(ctx) || { action: m.action, settings: (m.payload && m.payload.settings) || {}, device: m.device };
    execute(ctx, inst);
  }
});
ws.addEventListener("error", () => log("websocket error"));
ws.addEventListener("close", () => { log("websocket closed"); setTimeout(() => process.exit(0), 250); });
process.on("uncaughtException", e => log(`uncaught ${e.stack || e.message}`));
process.on("unhandledRejection", e => log(`rejection ${e && e.stack || e}`));
