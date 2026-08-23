# Stream Dashboard QA

## Build state

Product: Stream Dashboard

Slug: `obs-dashboard`

Branch: `product/obs-dashboard`

Manifest author: `PackRat 🐀`

Widget ID: `com.packrat.obsdashboard`

Version: `1.0.0`

Price target: `$12.99`

## Mandatory real transport spike

PASS from the user supplied machine level spike performed before product code was written.

A real Chromium page loaded from a `file://` origin connected to `ws://127.0.0.1:4455`. OBS accepted the WebSocket upgrade, returned its obs websocket v5 Hello frame, negotiated RPC version 1 capability, reported obs websocket 5.7.4, and required authentication.

This proves the real desktop transport path that cannot be reproduced from an isolated cloud runner against the user's localhost.

## Protocol implementation

PASS: obs websocket v5 Hello, Identify, Identified, Event, Request and RequestResponse flow.

PASS: password authentication using the documented two stage SHA 256 and Base64 challenge flow.

PASS: Web Crypto when available with a deterministic pure JavaScript SHA 256 fallback.

PASS: authentication computation cross checked against an independent Python `hashlib` implementation.

PASS: event subscriptions limited to Scenes and Outputs.

PASS: initial requests use `GetStreamStatus`, `GetRecordStatus`, `GetStats` and `GetSceneList`, with `GetCurrentProgramScene` only as fallback.

PASS: controls use only `SetCurrentProgramScene`, `StartStream` and `StopStream`.

PASS: bitrate is derived from consecutive `outputBytes` samples rather than a fabricated field.

PASS: dropped frame percentage uses stream output skipped frames over total frames.

PASS: encoder lag uses output thread skipped frames over total frames and is not mislabeled as encoder utilization.

PASS: recording disk space uses `availableDiskSpace`.

PASS: OBS password and authentication material are never stored in localStorage. Only sanitized last known dashboard state is cached per widget instance.

## Source and structure checks

PASS: uppercase `<!DOCTYPE html>`.

PASS: XML safe head structure.

PASS: documented `textfield` and `color` property types only.

PASS: Connection contains port and password only. Appearance is last.

PASS: no property name collides with an element ID.

PASS: complete runtime and settings translation coverage in English, German, Spanish and French.

PASS: JavaScript syntax check.

PASS: manifest, translation and submission JSON parsing.

PASS: authored CSS and JavaScript inline into one generated shipping `index.html`.

PASS: no remote scripts, remote stylesheets, fetch, XHR or EventSource.

PASS: the only product network destination is the user configurable local WebSocket at `ws://127.0.0.1:<port>`.

## Deterministic Chromium fixture QA

PASS: S horizontal 840 by 344.

PASS: S vertical 696 by 416.

PASS: M horizontal 840 by 696.

PASS: M vertical 696 by 840.

PASS: L horizontal 1688 by 696.

PASS: L vertical 696 by 1688.

PASS: XL horizontal 2536 by 696.

PASS: XL vertical 696 by 2536.

PASS: zero document overflow at all eight sizes.

PASS: all visible interactive targets remain at least 56 by 56 pixels.

PASS: Small layouts show the current scene plus the next two scenes rather than shrinking a full list.

PASS: Medium layouts use a horizontal touch scroll scene rail.

PASS: Large layouts use the three zone board composition.

PASS: XL horizontal uses a two column scene rail and increased information density.

PASS: scene switching behavior.

PASS: two tap stream confirmation behavior.

PASS: disconnected presentation.

PASS: authentication failure presentation.

PASS: zero runtime errors in deterministic connected, disconnected and authentication failure fixtures.

## Packaged network smoke

PASS on the exact official CORSAIR package produced by CI.

The package was extracted and its packaged `index.html` was loaded from `file://` in Chromium. A real WebSocket server listened on `127.0.0.1:4455` and implemented the required OBS websocket v5 message flow.

PASS: WebSocket request reached `ws://127.0.0.1:4455` with request origin `null`.

PASS: nonempty password challenge authentication succeeded.

PASS: Identify completed and the widget reached connected state.

PASS: `GetStreamStatus`, `GetRecordStatus`, `GetStats` and `GetSceneList` all reached the network server.

PASS: repeated stream polling produced a nonzero bitrate through real byte delta calculation.

PASS: touching BRB sent `SetCurrentProgramScene` with `sceneName: BRB` over the socket and the returned scene event updated the widget.

PASS: first stream control tap sent no `StopStream` request.

PASS: second confirmation tap sent `StopStream` over the socket and the returned stream event changed the widget to standby.

PASS: zero browser runtime errors.

Evidence artifact: `xeneon-obs-dashboard-network-smoke` from XENEON Widget CI run 68 on commit `4fbdbfbddb32b2a3724b296d88cb587bcf0995f6`.

## Shared owner pass

PASS: XENEON pull request workflows resolve the changed widget slug rather than defaulting to Now Playing.

PASS: deterministic Rat Art accepts product owned fixtures while preserving the existing Now Playing path.

PASS: non Now Playing Rat Art reads product owned `art.json` metadata.

PASS: Rat Ship invariants read each product's submission metadata and matching manifest rather than hardcoded Now Playing values.

PASS: StreamSpell distinguishes its preview only loopback WebSocket CSP restriction from genuine console errors.

PASS: optional product owned packaged network smoke tests can run after official packaging without making the shared pipeline product specific.

The historical `_shared/` runtime migration remains intentionally deferred. It is not required for this product and should only happen as a repository wide migration with parity testing.

The legacy `registry.json` host reconciliation for `127.0.0.1` remains intentionally untouched because the original product boundary forbids registry edits.

## Remote release gates

PASS: official CORSAIR `icuewidget-cli@0.4.47` validation.

PASS: official `.icuewidget` package creation.

PASS: StreamSpell validation of the exact official package.

PASS: all eight StreamSpell XENEON presets rendered.

PASS: zero genuine StreamSpell console errors.

PASS: StreamSpell records its `connect-src 'none'` localhost limitation separately rather than misclassifying it as a product error.

PASS: deterministic Rat Art from real widget captures.

PASS: Rat Ship package, search icon, marketplace art and Maker Console ship kit.

PASS: Maker Console Playwright kit preflight.

PASS: RatPack Context CI.

The final automated evidence set before this documentation update was green on commit `4fbdbfbddb32b2a3724b296d88cb587bcf0995f6`.

## Deliberate product limits

The widget does not claim encoder utilization because obs websocket does not expose a generic encoder utilization percentage through the selected requests.

The widget does not claim a direct bitrate field. It calculates bitrate from output byte deltas.

The widget does not add recording start or stop controls, replay buffer controls, source controls, audio mixing, Studio Mode preview switching or other OBS features outside the approved v1.

## Hardware boundary

A physical XENEON Edge is not required for release candidate status under the canonical RatPack XENEON release gate.

The remaining uncertainty is limited to behavior unique to the real iCUE widget host and physical XENEON Edge hardware. CORSAIR's current installation flow requires a compatible recognized device before a widget can be placed on a device screen, so there is no supported virtual Edge host available for this final layer.

A future real iCUE or XENEON Edge smoke test is optional extra confidence, not a blocker for this release candidate.
