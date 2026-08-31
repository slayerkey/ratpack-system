"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { AppAudioWorkerClient } = require("./worker-client.js");

(async () => {
  const assemblyPath = path.resolve(process.env.PACKRAT_APP_AUDIO_DLL || path.join(__dirname, "build", "PackRatAppAudio.dll"));
  assert(fs.existsSync(assemblyPath), `Precompiled helper missing: ${assemblyPath}`);
  const c = new AppAudioWorkerClient({ mock: false, assemblyPath, timeoutMs: 8000 });
  const started = Date.now();
  try {
    const ping = await c.ping();
    const elapsedMs = Date.now() - started;
    assert.equal(ping.ready, true);
    assert.equal(ping.mock, false);
    assert.equal(ping.type, "PackRatAppAudio.Core");
    assert.equal(ping.backend, "assembly");
    assert(Number.isInteger(c.pid) && c.pid > 0);
    console.log(`precompiled app-audio worker startup passed: DLL backend ready in ${elapsedMs}ms without runtime C# compilation`);
  } finally {
    await c.close();
  }
})().catch(e => { console.error(e.stack || e); process.exit(1); });
