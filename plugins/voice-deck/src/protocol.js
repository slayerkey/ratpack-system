import crypto from "node:crypto";

export const DISCORD_OPCODE = Object.freeze({
  HANDSHAKE: 0,
  FRAME: 1,
  CLOSE: 2,
  PING: 3,
  PONG: 4,
});

export function encodeDiscordFrame(opcode, payload) {
  const body = Buffer.isBuffer(payload)
    ? payload
    : Buffer.from(typeof payload === "string" ? payload : JSON.stringify(payload), "utf8");
  const header = Buffer.allocUnsafe(8);
  header.writeUInt32LE(opcode >>> 0, 0);
  header.writeUInt32LE(body.length >>> 0, 4);
  return Buffer.concat([header, body]);
}

export class DiscordFrameDecoder {
  constructor(onFrame) {
    this.onFrame = onFrame;
    this.buffer = Buffer.alloc(0);
  }

  push(chunk) {
    if (!chunk || chunk.length === 0) return;
    this.buffer = this.buffer.length ? Buffer.concat([this.buffer, chunk]) : Buffer.from(chunk);
    while (this.buffer.length >= 8) {
      const opcode = this.buffer.readUInt32LE(0);
      const length = this.buffer.readUInt32LE(4);
      if (length > 8 * 1024 * 1024) throw new Error(`Discord IPC frame too large: ${length}`);
      if (this.buffer.length < 8 + length) return;
      const payload = this.buffer.subarray(8, 8 + length);
      this.buffer = this.buffer.subarray(8 + length);
      this.onFrame(opcode, payload);
    }
  }
}

export function websocketAcceptValue(secWebSocketKey) {
  return crypto
    .createHash("sha1")
    .update(String(secWebSocketKey) + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11")
    .digest("base64");
}

export function encodeWebSocketFrame(payload, opcode = 0x1) {
  const body = Buffer.isBuffer(payload) ? payload : Buffer.from(String(payload), "utf8");
  const finOpcode = 0x80 | (opcode & 0x0f);
  if (body.length < 126) {
    return Buffer.concat([Buffer.from([finOpcode, body.length]), body]);
  }
  if (body.length <= 0xffff) {
    const header = Buffer.allocUnsafe(4);
    header[0] = finOpcode;
    header[1] = 126;
    header.writeUInt16BE(body.length, 2);
    return Buffer.concat([header, body]);
  }
  const header = Buffer.allocUnsafe(10);
  header[0] = finOpcode;
  header[1] = 127;
  header.writeBigUInt64BE(BigInt(body.length), 2);
  return Buffer.concat([header, body]);
}

export class WebSocketFrameDecoder {
  constructor(onFrame) {
    this.onFrame = onFrame;
    this.buffer = Buffer.alloc(0);
  }

  push(chunk) {
    if (!chunk || chunk.length === 0) return;
    this.buffer = this.buffer.length ? Buffer.concat([this.buffer, chunk]) : Buffer.from(chunk);
    while (this.buffer.length >= 2) {
      const first = this.buffer[0];
      const second = this.buffer[1];
      const fin = Boolean(first & 0x80);
      const opcode = first & 0x0f;
      const masked = Boolean(second & 0x80);
      let length = second & 0x7f;
      let offset = 2;

      if (length === 126) {
        if (this.buffer.length < 4) return;
        length = this.buffer.readUInt16BE(2);
        offset = 4;
      } else if (length === 127) {
        if (this.buffer.length < 10) return;
        const big = this.buffer.readBigUInt64BE(2);
        if (big > BigInt(8 * 1024 * 1024)) throw new Error(`WebSocket frame too large: ${big}`);
        length = Number(big);
        offset = 10;
      }

      const maskLength = masked ? 4 : 0;
      if (this.buffer.length < offset + maskLength + length) return;

      let mask;
      if (masked) {
        mask = this.buffer.subarray(offset, offset + 4);
        offset += 4;
      }

      const payload = Buffer.from(this.buffer.subarray(offset, offset + length));
      this.buffer = this.buffer.subarray(offset + length);

      if (masked) {
        for (let i = 0; i < payload.length; i += 1) payload[i] ^= mask[i % 4];
      }

      if (!fin && opcode !== 0x0) throw new Error("Fragmented WebSocket messages are not supported");
      this.onFrame(opcode, payload, fin);
    }
  }
}

export function isLoopbackAddress(value) {
  const address = String(value || "").toLowerCase();
  return (
    address === "127.0.0.1" ||
    address === "::1" ||
    address === "::ffff:127.0.0.1"
  );
}

export function isAllowedBridgeOrigin(value) {
  if (value === undefined || value === null || value === "") return true;
  const origin = String(value).toLowerCase();
  return (
    origin === "null" ||
    origin === "file://" ||
    origin === "http://127.0.0.1" ||
    origin.startsWith("http://127.0.0.1:") ||
    origin === "http://localhost" ||
    origin.startsWith("http://localhost:")
  );
}
