import assert from "node:assert/strict";
import test from "node:test";
import { DISCORD_OPCODE, DiscordFrameDecoder, encodeDiscordFrame } from "../src/protocol.js";

test("Discord IPC framing is little endian and survives chunked delivery", () => {
  const one = encodeDiscordFrame(DISCORD_OPCODE.HANDSHAKE, { v: 1, client_id: "123" });
  assert.equal(one.readUInt32LE(0), DISCORD_OPCODE.HANDSHAKE);
  assert.equal(one.readUInt32LE(4), one.length - 8);
  const frames = [];
  const decoder = new DiscordFrameDecoder((opcode, payload) => frames.push([opcode, JSON.parse(payload.toString("utf8"))]));
  const two = encodeDiscordFrame(DISCORD_OPCODE.FRAME, { cmd: "TEST" });
  const joined = Buffer.concat([one, two]);
  decoder.push(joined.subarray(0, 5));
  decoder.push(joined.subarray(5, 19));
  decoder.push(joined.subarray(19));
  assert.equal(frames.length, 2);
  assert.equal(frames[0][1].client_id, "123");
  assert.equal(frames[1][1].cmd, "TEST");
});

test("oversized Discord IPC frames fail closed", () => {
  const frame = Buffer.alloc(8);
  frame.writeUInt32LE(DISCORD_OPCODE.FRAME, 0);
  frame.writeUInt32LE(9 * 1024 * 1024, 4);
  const decoder = new DiscordFrameDecoder(() => {});
  assert.throws(() => decoder.push(frame), /too large/i);
});
