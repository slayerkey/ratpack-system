# Stream Dashboard QA

## Build state

Product: Stream Dashboard

Slug: `obs-dashboard`

Branch: `product/obs-dashboard`

Manifest author: `PackRat 🐀`

Widget ID: `com.packrat.obsdashboard`

Version: `1.0.0`

Price target: `$12.99`

## Mandatory transport spike

PASS from the user-supplied machine-level spike performed before product code was written.

The spike used a real Chromium page loaded from a `file://` origin against `ws://127.0.0.1:4455`. OBS accepted the WebSocket upgrade with the widget-origin behavior, returned its obs-websocket v5 Hello frame, negotiated RPC version 1 capability, reported obs-websocket 5.7.4, and indicated that authentication was required.

The ChatGPT execution environment cannot route to the user's localhost, so this exact live transport result is preserved as supplied evidence rather than being falsely rerun from an isolated runner.

## Protocol implementation

PASS: obs-websocket v5 Hello, Identify, Identified, Event, Request and RequestResponse message flow.

PASS: optional password authentication using the documented two-stage SHA-256 and Base64 challenge flow.

PASS: Web Crypto is preferred when available, with a deterministic pure-JavaScript SHA-256 fallback so authentication does not depend on secure-context behavior.

PASS: authentication computation cross-checked against an independent Python `hashlib` implementation.

PASS: event subscriptions are limited to Scenes and Outputs.

PASS: initial data requests use `GetStreamStatus`, `GetRecordStatus`, `GetStats` and `GetSceneList`, with `GetCurrentProgramScene` only as a fallback if the scene-list response lacks a current scene.

PASS: `SetCurrentProgramScene`, `StartStream` and `StopStream` are the only control requests used.

PASS: current bitrate is derived from consecutive `outputBytes` samples rather than inventing a nonexistent bitrate field.

PASS: dropped-frame percentage uses `GetStreamStatus.outputSkippedFrames / outputTotalFrames`.

PASS: encoder lag uses `GetStats.outputSkippedFrames / outputTotalFrames` and is labeled encoder lag, not encoder utilization or encoder load.

PASS: recording disk space uses `GetStats.availableDiskSpace`.

PASS: no OBS password, authentication secret, salt or challenge is written to localStorage. Only sanitized last-known dashboard state is cached per widget instance.

## Source and structure checks completed in ChatGPT execution environment

PASS: source uses uppercase `<!DOCTYPE html>`.

PASS: head void elements are self-closed and the non-script head parses as well-formed XML.

PASS: `<title>` uses `tr('Stream Dashboard')`.

PASS: settings use documented `textfield` and `color` property types only.

PASS: Connection group contains only port and password. Appearance is last.

PASS: property names do not collide with element IDs.

PASS: translation coverage is complete for all 46 settings and runtime translation keys in English, German, Spanish and French.

PASS: JavaScript syntax via `node --check`.

PASS: manifest, submission metadata and translation JSON parse cleanly.

PASS: authored CSS and JavaScript inline into one generated shipping `index.html` with no external stylesheet or script dependency.

PASS: the generated shipping document preserves an XML-safe head.

PASS: the only network endpoint in product code is the user-configurable local WebSocket at `ws://127.0.0.1:<port>`.

PASS: no remote scripts, remote stylesheets, fetch, XHR, EventSource or external WebSocket host is used.

PASS: no em dash or en dash appears in product source, package copy or metadata.

## Deterministic Chromium fixture QA

The generated self-contained shipping document was loaded into headless Chromium with a deterministic obs-websocket fixture injected before widget startup.

PASS: S horizontal, 840x344.

PASS: S vertical, 696x416.

PASS: M horizontal, 840x696.

PASS: M vertical, 696x840.

PASS: L horizontal, 1688x696.

PASS: L vertical, 696x1688.

PASS: XL horizontal, 2536x696.

PASS: XL vertical, 696x2536.

PASS: zero document overflow at all eight sizes.

PASS: all visible interactive targets remain at least 56 by 56 pixels.

PASS: Small layouts deliberately show the current scene plus the next two scenes rather than shrinking a full scene list.

PASS: Medium layouts use a horizontal touch-scroll scene rail.

PASS: Large layouts use the three-zone board composition.

PASS: XL horizontal uses a two-column scene rail and increased information density.

PASS: scene switching updates the program scene through `SetCurrentProgramScene` behavior.

PASS: stream state requires two taps within the confirmation window before StartStream or StopStream is sent.

PASS: disconnected state renders `OBS NOT CONNECTED` and a setup hint instead of a blank panel.

PASS: authentication failure renders `OBS AUTH FAILED` with a password-specific hint.

PASS: no page runtime errors in deterministic connected, disconnected or authentication-failure fixtures.

## Deliberate product limits

The widget does not claim encoder utilization because obs-websocket does not expose a generic encoder utilization percentage through the selected requests.

The widget does not claim a direct bitrate field. It calculates bitrate from byte deltas.

The widget does not add recording start or stop controls, replay-buffer controls, source controls, audio mixing, Studio Mode preview switching or other OBS features that are outside the approved v1.

## Shared pipeline blockers preserved in NEEDS.md

BLOCKED: official CORSAIR CLI validation and packaging have not been proven for this slug in GitHub Actions yet. The current PR workflow defaults to `now-playing`, and editing the shared workflow is outside this product's allowed write boundary.

BLOCKED: the current shared XENEON Rat Art capture and compositor are Now Playing-specific and cannot correctly fixture or compose Stream Dashboard without a shared tooling change.

BLOCKED: the current Rat Ship workflow contains Now Playing-specific name and price invariants.

A direct attempt to acquire `icuewidget-cli@0.4.47` inside the isolated ChatGPT container timed out, so this report does not misrepresent vendor validation as completed.

## Final manual confidence check

The remaining product-specific host check is a real authenticated OBS session from the user's machine: complete Identify with the configured password, receive initial state, switch a harmless test scene, and confirm that the two-tap stream control reaches OBS. The earlier mandatory transport spike already proves that the `file://` WebSocket route itself is viable.
