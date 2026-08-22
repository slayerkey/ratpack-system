# Now Playing QA

## Build state

Product: Now Playing Panel
Slug: `now-playing`
Branch target: `product/now-playing`
Manifest author: `PackRat 🐀`
Version: `1.0.0`

## Automated checks completed in ChatGPT execution environment

PASS: generated `widgets/now-playing/index.html` is a single self-contained document with local CSS and JavaScript inlined.

PASS: historical RatPack `check_structure.py` gate.

PASS: uppercase `<!DOCTYPE html>` and XML-safe head.

PASS: all seven settings declared and grouped, with Appearance last.

PASS: translation coverage is complete for English, German, Spanish, and French.

PASS: no remote scripts, CSS imports, fetch, XHR, or WebSocket usage.

PASS: JavaScript syntax via `node --check`.

PASS: manifest and translation JSON parsing.

PASS: Chromium runtime audit with a mocked iCUE Media provider at all eight XENEON slot sizes: 840x344, 696x416, 840x696, 696x840, 1688x696, 696x1688, 2536x696, and 696x2536.

PASS: zero page runtime errors across the eight-slot audit.

PASS: zero document overflow across all eight slots.

PASS: transport touch targets remain at least 56 px in both dimensions.

PASS: long-title stress test preserves the track-title hierarchy and switches to marquee rather than shrinking Large or XL titles to body-copy size.

PASS: transport taps invoke only previous, play/pause, and next and do not cycle the palette.

PASS: background tap cycles Artist -> Neon -> Ember -> Ocean and the tap override persists per widget instance until the settings-panel palette changes.

PASS: changing the artist changes both the deterministic generated color palette and field seed.

PASS: recent-track history records track transitions per widget instance and is visible only in XL layouts.

PASS: disabling Show Recent Tracks removes the XL history region and collapses its grid allocation.

PASS: idle state renders the ambient clock instead of a dead player.

PASS: unavailable provider state is distinct from idle and disables transport controls.

PASS: runtime visible copy uses the asynchronous `tr()` path rather than hardcoded English-only replacement logic.

## Deliberate API limits

The product uses only `songName`, `artist`, `triggerPreviousTrack()`, `triggerPlayPause()`, and `triggerNextTrack()` from the Media provider.

It does not claim or synthesize album art, progress, seek position, playback state, or visualization data.

The center control therefore uses a combined play/pause glyph instead of pretending the provider exposes current playback state.

## Remaining gates

BLOCKED IN CURRENT CHATGPT RUNTIME: `icuewidget validate widgets/now-playing` because the iCUE Widget CLI is not installed in this Linux execution environment.

BLOCKED IN CURRENT CHATGPT RUNTIME: `icuewidget package widgets/now-playing` for the same reason.

LOCAL FINAL TEST ONLY: import the vendor-created `.icuewidget` into iCUE, verify the real Media provider, touch behavior, fonts, and rendering on the physical XENEON Edge.

## Migration note

See `NEEDS.md` for the shared runtime and harness migration that still belongs in the canonical RatPack system. No edit to historical `_shared`, `_build`, or registry files was made for this product.
