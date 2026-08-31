# Stream Deck Ultimate App Volume checkpoint — 2026-08-30

## Status

App Volume is a validated experiment and co-installable hardware-test plugin. It is **not promoted into the accepted Stream Deck Ultimate plugin yet**.

The accepted v0.7.1 installable remains frozen.

## Accepted Stream Deck Ultimate baseline

- Accepted version: `v0.7.1 Support Beta`
- Accepted plugin UUID: `com.packrat.stream-deck-ultimate-bundle`
- Accepted source commit: `257dfe73ff37b5628a22bdece9718075f7d4f8b3`
- Accepted plugin source directory: `products/stream-deck-ultimate-bundle/prototype/com.packrat.stream-deck-ultimate-bundle.sdPlugin`

A compare from the accepted commit through the final App Volume Lab head showed no changed file inside the accepted `.sdPlugin` source directory. Experimental work remains under `products/stream-deck-ultimate-bundle/experiments/per-app-audio/`, workflows, docs, and test tooling.

## App Volume experiment

The experiment provides:

- Windows Core Audio application-session enumeration
- exact normalized process targeting
- PID-scoped Current App targeting
- native foreground-window PID/process resolution
- per-app volume set/adjust
- per-app mute/unmute
- safe `WAITING`, `AUDIO OFF`, and `SET APP` states
- shared session refresh cache
- concurrent refresh de-duplication
- dial-write coalescing
- foreground snapshot safety during dial bursts
- Current App and Specific App modes
- Stream Deck keypad rendering
- Stream Deck+ encoder feedback
- active-audio-app Property Inspector picker
- manual process-name fallback
- 1%, 2%, and 5% dial sensitivity
- optional press-to-mute
- local-only operation

## Precompiled native helper

The helper combines:

- `PackRatAppAudio.Core`
- `PackRatAppAudio.Foreground`

The production direction is a packaged DLL loaded once by a persistent PowerShell worker. Runtime C# compilation is retained only as an experimental source fallback.

A hosted Windows runner measured precompiled worker readiness in roughly 335–395 ms across successful runs.

## General per-app-audio CI

A definitive green host-bundle run was completed at:

- head: `75f09b3f98c2273866c3a5efd8411b5772e09c67`
- run ID: `33355021004`
- job ID: `99375390378`
- result: success

That run proved:

- session/product model
- shared service behavior
- Current App safety semantics
- Stream Deck surface behavior
- lifecycle controller
- composed runtime
- protocol bridge
- Property Inspector contract
- persistent mock worker
- native source worker startup
- precompiled DLL worker startup
- native foreground P/Invoke
- hash-backed read-only host harness
- source-free host bundle staging
- source-free host bundle boot through the packaged DLL

A later consistency run after lab-builder changes also passed:

- head: `cecdbc906c7ca7bde9aea269c72a9a281f2e9896`
- general per-app-audio run ID: `33355631675`
- result: success

Hosted GitHub Windows runners do not expose a usable normal playback endpoint. Enumeration there can return `0x80070490 Element not found`; this is why real-host write proof remains a physical Windows gate.

## Source-free Windows host-test artifact

GitHub artifact from run `33355021004`:

- artifact ID: `9744850078`
- artifact name: `stream-deck-ultimate-per-app-audio-host-test`
- artifact ZIP SHA256: `66208d7d17f47d0fafb03dbc21af68ec15ecc1f063a01f6e5573e131c9799047`

The six-file bundle contains:

- `app-audio.ps1`
- `BUNDLE_INFO.json`
- `HOST_TEST.md`
- `PackRatAppAudio.dll`
- `real-host-smoke.ps1`
- `run-host-test.cmd`

It contains no C# source or build script.

The harness is read-only by default. With `-Exercise`, it changes one exact target by one percentage point, verifies the change, restores the original volume, and verifies restoration. It never changes mute state.

Required real-host promotion result:

`write-and-restore-pass`

## Co-installable App Volume Lab plugin

Lab plugin identity:

- plugin UUID: `com.packrat.stream-deck-ultimate-app-volume-lab`
- action UUID: `com.packrat.stream-deck-ultimate-app-volume-lab.app-audio`
- name: `Ultimate App Volume Lab`
- version: `0.8.0.1`
- Windows only

The lab plugin is deliberately separate from the accepted Ultimate UUID so it can be installed beside v0.7.1 for hardware proof.

Final scrubbed Lab CI:

- final head: `e93474e7dce8789ec09f9c59860139328b0e7cbe`
- run ID: `33355663550`
- job ID: `99377198970`
- result: success

The final run passed:

1. App Volume product and Stream Deck semantics
2. JavaScript syntax
3. PowerShell syntax
4. precompiled Core Audio + foreground helper build
5. co-installable lab staging
6. locked WebSocket runtime install
7. packaged lab runtime through a real local WebSocket simulation
8. plugin/action UUID and helper integrity checks
9. zero accepted-product UUID references in staged text
10. Elgato CLI installation
11. official `streamdeck validate`
12. official `streamdeck pack`
13. artifact upload

Final GitHub lab artifact:

- artifact ID: `9745057104`
- artifact name: `stream-deck-ultimate-app-volume-lab`
- artifact ZIP SHA256: `3b6a9a7e249f2036aa42cc0167620ebc7f5f6c33b2388fdf4b3406c5e03d666b`

Final packed `.streamDeckPlugin` local verification:

- size: `109647` bytes
- SHA256: `b8836706545dcd151dbefcc24d3e831b2738e45a30e0d34ea6e2698185d32337`
- archive integrity: pass
- manifest plugin UUID: `com.packrat.stream-deck-ultimate-app-volume-lab`
- manifest action UUID: `com.packrat.stream-deck-ultimate-app-volume-lab.app-audio`
- helper DLL SHA256: `229c765d88cb817602a4a9e20c18dafbb06d2ffda2f39b5eba6bc739c48f3ac5`
- helper hash matches `LAB_INFO.json`: yes
- accepted Ultimate UUID references inside packed lab text: `0`

## Packaged WebSocket smoke proof

The staged lab plugin was spawned as its actual packaged Node entrypoint and connected to a local WebSocket server using Stream Deck-shaped messages.

The smoke test proved:

- plugin registration
- Current App encoder initial feedback
- dial volume adjustment
- press-to-mute
- Property Inspector active-app options
- Specific App keypad rendering
- process stays alive through the interaction sequence

This is intentionally stronger than a pure unit test but still does not substitute for physical Stream Deck hardware and a real Windows playback endpoint.

## Strict promotion gate

Do **not** merge App Volume into the accepted Ultimate plugin merely because CI passes.

Promotion requires all of the following:

1. automated App Volume semantics green
2. official Elgato validation/packing green
3. exact packaged helper used on a normal Windows desktop
4. real-host read-only session proof
5. hash-matched `write-and-restore-pass`
6. physical Stream Deck keypad proof
7. physical Stream Deck+ encoder proof when available
8. Current App focus-switch safety observed on hardware
9. Specific App targeting observed on hardware
10. accepted Ultimate regression suite green after integration

Only after those gates should the App Volume action be promoted into the Ultimate manifest/runtime.

## Hardware test commands

From the extracted source-free host-test bundle:

Read-only inventory:

```bat
run-host-test.cmd
```

Read-only named app:

```bat
run-host-test.cmd -Process Spotify
```

Reversible write/restore:

```bat
run-host-test.cmd -Process Spotify -Exercise
```

If multiple PIDs match:

```bat
run-host-test.cmd -Pid 1234 -Exercise
```

## Hardware feedback needed

No manual debugging is required. Record only observations and generated JSON:

- host read-only status
- host write/restore status
- Current App key behavior
- Current App dial behavior if Stream Deck+ is available
- fast focus-switch targeting behavior
- Specific App behavior
- active-app picker behavior
- mute behavior
- displayed volume accuracy/latency

If a gate fails, diagnose from the report and observed UI before changing the accepted plugin.
