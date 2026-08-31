"use strict";
const assert = require("assert");
const { ACTION_UUID } = require("./action-spec.js");
const { createAppAudioRuntime } = require("./runtime-factory.js");
const { compactKeyTitle, createProtocolRenderer, AppAudioActionBridge } = require("./streamdeck-bridge.js");

(async () => {
  assert.equal(compactKeyTitle({ title: "Discord", value: "42%", status: "active" }), "DISCORD\n42%");
  assert.equal(compactKeyTitle({ title: "Anything", value: "AUDIO OFF", status: "unavailable" }), "AUDIO\nOFF");
  assert.equal(compactKeyTitle({ title: "Anything", value: "SET APP", status: "unconfigured" }), "SET\nAPP");

  const outbound = [];
  const renderer = createProtocolRenderer(message => outbound.push(JSON.parse(JSON.stringify(message))));
  const runtime = createAppAudioRuntime({ mock: true, cacheMs: 5000, coalesceMs: 15, render: renderer });
  const bridge = new AppAudioActionBridge({ runtime });
  try {
    await runtime.start();

    const ignored = await bridge.handle({ event: "willAppear", action: "com.other.action", context: "x", payload: {} });
    assert.equal(ignored.handled, false);
    assert.equal(outbound.length, 0);

    // Actual Stream Deck encoder payload -> setFeedback.
    let result = await bridge.handle({
      event: "willAppear", action: ACTION_UUID, context: "current-dial",
      payload: { controller: "Encoder", settings: { mode: "current", step: 2 } }
    });
    assert.equal(result.handled, true);
    assert.deepEqual(outbound.at(-1), {
      event: "setFeedback", context: "current-dial",
      payload: { title: "SPOTIFY", value: "35%", indicator: { value: 35 } }
    });

    await bridge.handle({
      event: "dialRotate", action: ACTION_UUID, context: "current-dial",
      payload: { controller: "Encoder", settings: { mode: "current", step: 2 }, ticks: 1 }
    });
    assert.deepEqual(outbound.at(-1), {
      event: "setFeedback", context: "current-dial",
      payload: { title: "SPOTIFY", value: "37%", indicator: { value: 37 } }
    });

    // Keypad uses one compact two-line title, avoiding uncontrolled multi-label layouts.
    await bridge.handle({
      event: "willAppear", action: ACTION_UUID, context: "discord-key",
      payload: { controller: "Keypad", settings: { mode: "process", process: "discord", step: 2 } }
    });
    assert.deepEqual(outbound.at(-1), {
      event: "setTitle", context: "discord-key",
      payload: { title: "DISCORD\n42%", target: 0 }
    });

    await bridge.handle({
      event: "keyUp", action: ACTION_UUID, context: "discord-key",
      payload: { controller: "Keypad", settings: { mode: "process", process: "discord", step: 2 } }
    });
    assert.deepEqual(outbound.at(-1), {
      event: "setTitle", context: "discord-key",
      payload: { title: "DISCORD\nMUTED", target: 0 }
    });

    await bridge.handle({
      event: "didReceiveSettings", action: ACTION_UUID, context: "discord-key",
      payload: { settings: { mode: "process", process: "" } }
    });
    assert.deepEqual(outbound.at(-1), {
      event: "setTitle", context: "discord-key",
      payload: { title: "SET\nAPP", target: 0 }
    });

    console.log("shadow App Volume Stream Deck protocol passed: action routing, real payload shapes, encoder setFeedback, compact keypad setTitle, live Current App and mute updates");
  } finally {
    await runtime.dispose();
  }
})().catch(e => { console.error(e.stack || e); process.exit(1); });
