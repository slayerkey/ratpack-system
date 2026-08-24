import assert from "node:assert/strict";
import test from "node:test";
import {
  STREAMKIT_DOM_EXPRESSION,
  buildStreamKitUrl,
  normalizeDomSnapshot,
  normalizeStreamKitConfig,
} from "../src/streamkit-edge.js";

test("StreamKit config requires Discord server and voice channel IDs", () => {
  assert.deepEqual(normalizeStreamKitConfig({ guildId: "123456789012345678", channelId: "987654321098765432", channelLabel: "Lobby" }), {
    guildId: "123456789012345678",
    channelId: "987654321098765432",
    channelLabel: "Lobby",
  });
  assert.throws(() => normalizeStreamKitConfig({ guildId: "", channelId: "987654321098765432" }), /Server ID/);
});

test("StreamKit URL uses official Discord voice overlay route", () => {
  const url = new URL(buildStreamKitUrl({ guildId: "123456789012345678", channelId: "987654321098765432", channelLabel: "Lobby" }));
  assert.equal(url.origin, "https://streamkit.discord.com");
  assert.equal(url.pathname, "/overlay/voice/123456789012345678/987654321098765432");
  assert.equal(url.searchParams.get("streamer_avatar_first"), "true");
  assert.equal(url.searchParams.get("limit_speaking"), "false");
  assert.equal(url.searchParams.get("bg_opacity"), "0");
});

test("StreamKit DOM snapshot normalizes roster and speaking state", () => {
  const snapshot = normalizeDomSnapshot({
    pageReady: true,
    documentReady: "complete",
    rows: [
      { id: "111111111111111111", name: "PackRat", avatarUrl: "https://cdn.discordapp.com/avatars/111111111111111111/hash.png", speaking: true, mute: false, deaf: false },
      { id: "222222222222222222", name: "Teammate", avatarUrl: "https://cdn.discordapp.com/avatars/222222222222222222/hash.png", speaking: false, mute: true, deaf: false },
    ],
  }, { guildId: "123456789012345678", channelId: "987654321098765432", channelLabel: "Ranked" });
  assert.equal(snapshot.pageReady, true);
  assert.equal(snapshot.channel.name, "Ranked");
  assert.equal(snapshot.members.length, 2);
  assert.equal(snapshot.members[0].speaking, true);
  assert.equal(snapshot.members[1].mute, true);
  assert.deepEqual(snapshot.selfVoice, { mute: false, deaf: false });
});

test("StreamKit DOM probe uses resilient class substring selectors", () => {
  assert.match(STREAMKIT_DOM_EXPRESSION, /Voice_voiceStates/);
  assert.match(STREAMKIT_DOM_EXPRESSION, /Voice_voiceState/);
  assert.match(STREAMKIT_DOM_EXPRESSION, /Voice_avatar/);
  assert.match(STREAMKIT_DOM_EXPRESSION, /Voice_name/);
  assert.match(STREAMKIT_DOM_EXPRESSION, /speaking/i);
});
