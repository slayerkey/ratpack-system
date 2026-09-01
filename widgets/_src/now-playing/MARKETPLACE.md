# Now Playing Panel marketplace prep

## Metadata

Name: Now Playing Panel

Category: Widget

Price: $9.99

Version: 1.0.0

Author: PackRat 🐀

Supported device: CORSAIR XENEON Edge

OS: Windows

Keywords: now playing, media controls, music widget, xeneon edge, playback controls

## Description

See the current song, artist, and playback controls on your XENEON Edge without going back to the desktop.

- Large auto-fitting track and artist text keeps the music readable at a glance.
- Previous, play/pause, and next are built in as large touch controls.
- Four artist-reactive palette styles: Artist, Neon, Ember, and Ocean.
- XL keeps a local recently played list.
- When nothing is playing, the panel becomes a clean ambient clock.

Setup is handled through the Windows system media session in iCUE, so compatible desktop players and browsers work without a separate PackRat helper app.

Compatibility: Windows + CORSAIR XENEON Edge. The iCUE Media provider does not expose album art, a progress bar, or seek controls, so this widget does not pretend those features exist.

Made by PackRat.

## Release notes

- Large auto-fitting track title and artist typography.
- Artist-reactive gradients with Artist, Neon, Ember, and Ocean presets.
- Previous, play/pause, and next touch controls.
- Ambient idle clock and local recently played history on XL.
- Tuned layouts for S, M, L, and XL in horizontal and vertical orientations.

## Media strategy

The V2 cover uses the real widget inside the approved XENEON Edge device plate. The product is deliberately larger than the title/branding chrome.

A short product demo is recommended because playback state, controls, palette changes, recent tracks, and idle behavior are faster to understand in motion. It should open on the real product immediately with no logo intro.

If the demo is available at submission time, place it immediately after the cover.

Static fallback order:

1. `icon-288x288.png` — search icon only.
2. `1-hero.png` — cover.
3. `3-features.png` — core value / why it matters.
4. `2-showcase.png` — product in use.
5. `4-settings.png` — palette choices and depth.
6. `5-sizes.png` — compatibility confidence.

Do not upload the search icon as gallery content.

## Package

Use the `.icuewidget` created by the successful XENEON Widget CI / Rat Ship workflow for the release candidate. The official CORSAIR CLI validation and package job remains the canonical package source.

## Submission cautions

Price is `$9.99` because that is the approved product value. Maker Console pricing has historically required support intervention to change, so double check it before creating or updating the product.

The final marketplace submission remains a human action. Do not automate the final Submit click.
