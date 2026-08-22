# Now Playing Panel marketplace prep

## Metadata

Name: Now Playing Panel

Category: Widget

Price: $9.99

Version: 1.0.0

Author: PackRat 🐀

Supported device: Corsair Xeneon Edge

OS: Windows

Keywords: now playing, media controls, music widget, xeneon edge, spotify controls

## Description

Now Playing Panel for the Corsair Xeneon Edge.

See the current song and artist across your desk, with previous, play or pause, and next always within reach.

Works through the Windows system media session in iCUE, so it can follow compatible desktop players and browsers without a separate helper app.

**Typography first**  The track title fills the panel in large auto fitting type, with the artist directly beneath it.

**Artist driven color**  A deterministic generative gradient gives each artist its own visual character, with Artist, Neon, Ember and Ocean presets.

**Three media controls**  Previous, play or pause, and next are large touch targets built for the display.

**Recently played on XL**  Track changes are kept locally per widget instance and appear in the XL layout.

**Ambient when idle**  When nothing is playing, the panel becomes a clean gradient clock instead of a dead rectangle.

There is no album art, progress bar or seek control because the iCUE Media provider does not expose those values.

---

Part of the PackRat 🐀 collection for the Corsair Xeneon Edge.

now playing, media controls, music widget, xeneon edge, spotify controls

## Release notes

• Large auto fitting track title and artist typography.

• Deterministic artist driven gradient with Artist, Neon, Ember and Ocean presets.

• Previous, play or pause, and next touch controls.

• Ambient idle clock and local recently played history on XL.

• Tuned layouts for S, M, L and XL in horizontal and vertical orientations.

## Media map

1. `icon-288x288.png` becomes the search icon.
2. `1-hero.png` becomes the cover.
3. `2-showcase.png` becomes gallery image 1.
4. `3-features.png` becomes gallery image 2.
5. `4-settings.png` becomes gallery image 3.
6. `5-sizes.png` becomes gallery image 4.

Gallery order is intentional and should not be rearranged after upload.

## Package

Use the `.icuewidget` created by the successful `XENEON Widget CI` workflow for this branch. The official CORSAIR CLI validation and package job is the canonical package source.

## Submission cautions

Price is `$9.99` because that is the approved value in the build handoff. Maker Console pricing has historically required support intervention to change, so double check it before creating the product.

The final marketplace submission remains a human action. Do not automate the final Submit click.