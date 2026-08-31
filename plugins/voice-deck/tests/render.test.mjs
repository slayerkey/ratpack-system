import assert from "node:assert/strict";
import test from "node:test";
import { renderKey, svgDataUri } from "../src/render.js";

function decode(uri) {
  return Buffer.from(String(uri).split(",")[1], "base64").toString("utf8");
}

const ready = {
  discord: { ready: true, authenticated: true },
  auth: { stage: "ready" },
  guild: { id: "g", name: "Guild <&>" },
  channel: { id: "c", name: "General Voice" },
  voice: { mute: false, deaf: false },
  members: [{ id: "1", displayName: "Zoë <script> 🌙", username: "@zoe", avatarUrl: "", mute: false, deaf: false, speaking: true, recentlySpeaking: false, lastSpokeAt: 50, holdUntil: 1000, order: 0, self: false }],
};

test("every core action produces a Stream Deck image data URI", () => {
  for (const kind of ["status", "mute", "deafen", "combined", "channel", "member", "member-slot", "spotlight", "activity", "count", "connection"]) {
    const settings = kind === "member" ? { memberId: "1" } : { slotIndex: 1 };
    const image = renderKey(kind, ready, settings, { now: 100 });
    assert.match(image, /^data:image\/svg\+xml;base64,/);
    assert.match(decode(image), /^<svg/);
  }
});

test("dynamic member rendering escapes hostile display text", () => {
  const svg = decode(renderKey("member-slot", ready, { slotIndex: 1 }, { now: 100 }));
  assert.equal(svg.includes("<script>"), false);
  assert.equal(svg.includes("&lt;script&gt;"), true);
});

test("member avatars stay circular and the speaking ring is a separate layer", () => {
  const avatarData = "data:image/png;base64,AAAA";
  const svg = decode(renderKey("member-slot", ready, { slotIndex: 1 }, { now: 100, avatarData, pulsePhase: true }));
  assert.equal(svg.includes("clipPath"), false);
  assert.match(svg, /<pattern id="avatarPattern"/);
  assert.match(svg, /<circle cx="72" cy="59" r="35"[^>]*stroke-width="8"/);
  assert.match(svg, /<circle cx="72" cy="59" r="31" fill="url\(#avatarPattern\)"\/>/);
  assert.ok(svg.indexOf('r="35"') < svg.indexOf('fill="url(#avatarPattern)"'));
});

test("mute and deafen state changes alter rendered image immediately", () => {
  const muteOff = renderKey("mute", ready, {});
  const muteOn = renderKey("mute", { ...ready, voice: { mute: true, deaf: false } }, {});
  const deafOn = renderKey("deafen", { ...ready, voice: { mute: false, deaf: true } }, {});
  assert.notEqual(muteOff, muteOn);
  assert.match(decode(muteOn), /MUTED/);
  assert.match(decode(deafOn), /DEAFENED/);
});

test("disconnected and authorization-needed states are explicit", () => {
  const closed = decode(renderKey("connection", { discord: { ready: false, authenticated: false, handshake: "offline" }, auth: { stage: "idle" }, members: [] }, {}));
  const auth = decode(renderKey("connection", { discord: { ready: true, authenticated: false }, auth: { stage: "authorization_required" }, members: [] }, {}));
  assert.match(closed, /CLOSED/);
  assert.match(auth, /NEEDED/);
});

test("svgDataUri is stable for identical input", () => {
  assert.equal(svgDataUri("<svg></svg>"), svgDataUri("<svg></svg>"));
});
