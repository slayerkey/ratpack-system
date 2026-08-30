import assert from "node:assert/strict";
import net from "node:net";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  DISCORD_OPCODE,
  DiscordFrameDecoder,
  WebSocketFrameDecoder,
  encodeDiscordFrame,
  isAllowedBridgeOrigin,
  websocketAcceptValue,
} from "../src/protocol.js";
import { LocalBridgeServer } from "../src/local-bridge.js";

test("Discord IPC framing is little endian and decodes chunked frames", () => {
  const one = encodeDiscordFrame(DISCORD_OPCODE.HANDSHAKE, { v: 1, client_id: "123" });
  assert.equal(one.readUInt32LE(0), 0);
  assert.equal(one.readUInt32LE(4), one.length - 8);

  const frames = [];
  const decoder = new DiscordFrameDecoder((opcode, payload) => frames.push([opcode, payload.toString("utf8")]));
  const two = encodeDiscordFrame(DISCORD_OPCODE.FRAME, { cmd: "TEST" });
  const joined = Buffer.concat([one, two]);
  decoder.push(joined.subarray(0, 5));
  decoder.push(joined.subarray(5, 17));
  decoder.push(joined.subarray(17));
  assert.equal(frames.length, 2);
  assert.equal(frames[0][0], DISCORD_OPCODE.HANDSHAKE);
  assert.match(frames[0][1], /client_id/);
  assert.equal(frames[1][0], DISCORD_OPCODE.FRAME);
});

test("WebSocket accept value matches RFC 6455 example", () => {
  assert.equal(
    websocketAcceptValue("dGhlIHNhbXBsZSBub25jZQ=="),
    "s3pPLMBiTxaQ9kYGzzhZRbK+xOo=",
  );
});

test("Bridge origin allowlist accepts XENEON file origins but rejects web origins", () => {
  assert.equal(isAllowedBridgeOrigin("null"), true);
  assert.equal(isAllowedBridgeOrigin("file://"), true);
  assert.equal(isAllowedBridgeOrigin("http://127.0.0.1:1234"), true);
  assert.equal(isAllowedBridgeOrigin("https://example.com"), false);
});

function maskedTextFrame(text) {
  const payload = Buffer.from(text, "utf8");
  const mask = Buffer.from([1, 2, 3, 4]);
  const header = payload.length < 126
    ? Buffer.from([0x81, 0x80 | payload.length])
    : (() => {
        const value = Buffer.alloc(4);
        value[0] = 0x81;
        value[1] = 0x80 | 126;
        value.writeUInt16BE(payload.length, 2);
        return value;
      })();
  const masked = Buffer.from(payload);
  for (let index = 0; index < masked.length; index += 1) masked[index] ^= mask[index % 4];
  return Buffer.concat([header, mask, masked]);
}

test("WebSocket decoder handles masked browser text frames", () => {
  const messages = [];
  const decoder = new WebSocketFrameDecoder((opcode, payload) => messages.push([opcode, payload.toString("utf8")]));
  const frame = maskedTextFrame('{"command":"refresh"}');
  decoder.push(frame.subarray(0, 3));
  decoder.push(frame.subarray(3));
  assert.deepEqual(messages, [[1, '{"command":"refresh"}']]);
});

test("Local bridge accepts Origin null and emits commands", async () => {
  const state = { protocol: 1, discord: { ready: true } };
  const server = new LocalBridgeServer({ port: 17493, snapshot: () => state });
  await server.start();

  try {
    const health = await fetch("http://127.0.0.1:17493/health");
    assert.equal(health.status, 200);
    const body = await health.json();
    assert.equal(body.ok, true);
    assert.equal(body.protocol, 1);

    const command = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("command timeout")), 1500);
      server.once("command", (message) => {
        clearTimeout(timer);
        resolve(message);
      });
    });

    const socket = net.createConnection({ host: "127.0.0.1", port: 17493 });
    await new Promise((resolve, reject) => {
      socket.once("connect", resolve);
      socket.once("error", reject);
    });

    socket.write(
      "GET / HTTP/1.1\r\n" +
      "Host: 127.0.0.1:17493\r\n" +
      "Upgrade: websocket\r\n" +
      "Connection: Upgrade\r\n" +
      "Sec-WebSocket-Version: 13\r\n" +
      "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n" +
      "Origin: null\r\n\r\n",
    );

    const handshake = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("handshake timeout")), 1500);
      socket.once("data", (chunk) => {
        clearTimeout(timer);
        resolve(chunk);
      });
    });
    assert.match(handshake.toString("latin1"), /101 Switching Protocols/);

    socket.write(maskedTextFrame('{"command":"refresh"}'));
    assert.deepEqual(await command, { command: "refresh" });
    socket.destroy();
  } finally {
    await server.stop();
  }
});

// The Stream Deck action should communicate expected states through its key title,
// not the warning triangle overlay.
test("plugin operational flow does not invoke Stream Deck warning overlays", async () => {
  const source = await readFile(resolve(process.cwd(), "src/plugin.js"), "utf8");
  const operational = source
    .replace(/showAlert\(context\) \{[\s\S]*?\n  \}/, "")
    .replace(/showAlertAll\(\) \{[\s\S]*?\n  \}/, "");
  assert.equal(operational.includes("streamDeck.showAlert("), false);
  assert.equal(operational.includes("streamDeck.showAlertAll("), false);
});
