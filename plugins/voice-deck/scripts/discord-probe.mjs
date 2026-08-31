import process from "node:process";
import { VoiceSession } from "../src/voice-session.js";
import { speakingCount } from "../src/model.js";

function argValue(prefix, fallback) {
  const item = process.argv.find((arg) => arg.startsWith(prefix));
  if (!item) return fallback;
  return item.slice(prefix.length);
}

const requireVoice = process.argv.includes("--require-voice");
const observeSeconds = Math.max(0, Math.min(60, Number(argValue("--observe=", "8")) || 8));
let lastSnapshot = null;
let stateEvents = 0;
let speakingTransitions = 0;
let previousSpeaking = null;

function redacted(snapshot) {
  return {
    ready: Boolean(snapshot?.discord?.ready),
    authenticated: Boolean(snapshot?.discord?.authenticated),
    handshake: snapshot?.discord?.handshake || "idle",
    authStage: snapshot?.auth?.stage || "idle",
    tokenPersistence: snapshot?.auth?.tokenPersistence || "unknown",
    scopes: Array.isArray(snapshot?.scopes) ? snapshot.scopes.slice().sort() : [],
    inVoice: Boolean(snapshot?.channel?.id),
    memberCount: Array.isArray(snapshot?.members) ? snapshot.members.length : 0,
    speakingCount: speakingCount(snapshot?.members || []),
    mute: Boolean(snapshot?.voice?.mute),
    deaf: Boolean(snapshot?.voice?.deaf),
    lastDiscordEventAt: snapshot?.lastDiscordEventAt || null,
    error: snapshot?.auth?.lastError || snapshot?.error || null,
  };
}

function print(label, value) {
  process.stdout.write(`${label}: ${typeof value === "string" ? value : JSON.stringify(value)}\n`);
}

const session = new VoiceSession({
  log: (message) => print("discord", String(message)),
});

session.on("state", (snapshot) => {
  stateEvents += 1;
  lastSnapshot = snapshot;
  const current = speakingCount(snapshot?.members || []);
  if (previousSpeaking !== null && current !== previousSpeaking) speakingTransitions += 1;
  previousSpeaking = current;
});

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  print("Voice Deck Discord probe", "development diagnostic only");
  print("Token policy", "memory only; no token values are printed or persisted");

  const connected = await session.connect();
  if (!connected || !session.snapshot().discord.ready) {
    throw new Error(session.snapshot().error || "Discord Desktop IPC was not found");
  }

  if (!session.snapshot().discord.authenticated) {
    print("Authorization", "required; requesting the same development authorization path used by Voice Deck");
    const authorized = await session.beginAuthorization();
    if (!authorized) {
      throw new Error(session.snapshot().auth?.lastError || "Discord authorization failed");
    }
  }

  await session.refresh();
  let snapshot = session.snapshot();
  if (requireVoice && !snapshot.channel?.id) {
    throw new Error("Discord is authorized, but you are not currently in a voice channel. Join one and rerun the probe.");
  }

  print("Initial state", redacted(snapshot));
  if (observeSeconds > 0) {
    print("Observe", `${observeSeconds}s; talk or have someone talk to prove live speaking events`);
    await sleep(observeSeconds * 1000);
    snapshot = lastSnapshot || session.snapshot();
  }

  const result = {
    status: "PASS",
    stateEvents,
    speakingTransitions,
    snapshot: redacted(snapshot),
    note: "This proves the Discord transport layer only. Physical Stream Deck behavior still requires REAL_WINDOWS_SMOKE.md.",
  };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

try {
  await main();
} catch (error) {
  const result = {
    status: "FAIL",
    stateEvents,
    speakingTransitions,
    snapshot: redacted(lastSnapshot || session.snapshot()),
    error: String(error?.message || error),
  };
  process.stderr.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = 1;
} finally {
  session.close();
}
