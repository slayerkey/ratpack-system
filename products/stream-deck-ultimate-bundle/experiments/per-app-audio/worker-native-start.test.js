"use strict";
const assert = require("assert");
const { AppAudioWorkerClient } = require("./worker-client.js");

(async () => {
  const c = new AppAudioWorkerClient({ mock: false, timeoutMs: 12000 });
  try {
    // This proves the persistent worker can load/compile the real COM interop and speak the protocol.
    // It deliberately does not require a hosted CI runner to expose a playback endpoint.
    const ping = await c.ping();
    assert.equal(ping.ready, true);
    assert.equal(ping.mock, false);
    assert.equal(ping.type, "PackRatAppAudio.Core");
    assert(Number.isInteger(c.pid) && c.pid > 0);
    console.log("native app-audio worker startup passed: real Core Audio interop loaded once and JSON protocol became ready");
  } finally {
    await c.close();
  }
})().catch(e => { console.error(e.stack || e); process.exit(1); });
