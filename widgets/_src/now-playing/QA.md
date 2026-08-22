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

## Clean GitHub runner verification

PASS: `icuewidget-cli@0.4.47` executed on a clean GitHub Windows runner.

PASS: official `icuewidget validate widgets/now-playing` returned `Widget is valid` for Now Playing Panel 1.0.0.

PASS: official `icuewidget package widgets/now-playing` created `now-playing-panel.icuewidget`.

PASS: the official package was preserved as the GitHub Actions artifact `xeneon-now-playing-package`.

PASS: the exact official package was then opened by a locally hosted checkout of StreamSpell's `xeneon-edge-widget-builder` on a clean Ubuntu runner.

PASS: StreamSpell reported `Validation passed` and identified `Now Playing Panel 1.0.0` with four packaged files.

PASS: StreamSpell exposed and rendered all eight XENEON presets: S horizontal, S vertical, M horizontal, M vertical, L horizontal, L vertical, XL horizontal, and XL vertical.

PASS: StreamSpell recorded zero console errors.

PASS: eight StreamSpell screenshots plus `streamspell-result.json` were preserved as the GitHub Actions artifact `xeneon-now-playing-streamspell`.

## Deliberate API limits

The product uses only `songName`, `artist`, `triggerPreviousTrack()`, `triggerPlayPause()`, and `triggerNextTrack()` from the Media provider.

It does not claim or synthesize album art, progress, seek position, playback state, or visualization data.

The center control therefore uses a combined play/pause glyph instead of pretending the provider exposes current playback state.

## Release boundary

PackRat does not currently own a physical XENEON Edge. Physical hardware is therefore not a required release gate for this product.

Media behavior is tested against deterministic iCUE provider fixtures. The official CLI proves the shipping structure is accepted and packageable. StreamSpell independently proves the produced `.icuewidget` can be extracted, validated, and rendered through all eight XENEON viewport presets.

A real iCUE Media provider or physical XENEON smoke test may be added later if compatible hardware becomes available, but lack of hardware alone does not block this release candidate.

## Migration note

See `NEEDS.md` for the remaining shared runtime migration. The reusable StreamSpell packaged-widget harness and XENEON GitHub Actions workflow have now been restored in the canonical RatPack hub. No edit to historical `_shared`, `_build`, or registry files was made for this product.
