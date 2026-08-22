# Now Playing Panel Rat Art review

Status: `CANDIDATE_NEEDS_RERENDER`

Version: `1.0.0`

Price from `docs/BUILD_HANDOFF_XENEON_2026-08-16.md` section 2.2: `$9.99`

This is an isolated Rat Art candidate. It has not been promoted into a live marketplace marketing location.

## Current invalidation

The previous candidate was visually rejected after review because the lowercase `g` descender in the large Now Playing title was clipped inside the real widget capture.

Root cause was product CSS, not the marketplace compositor: `#trackTitle` used `line-height: 0.91` inside an intentional clipping viewport. The canonical source now uses a descender-safe `line-height: 1.04`.

The XENEON CI path now regenerates the shipping `index.html` from canonical source with `tools/xeneon/inline.py` before official CORSAIR validation and packaging. The corrected package passed official validation, packaging, and StreamSpell packaged preview.

The hashes below describe the rejected pre-fix candidate only. They must not be promoted. Rat Art must rerender from the corrected package and produce a new review set and new hashes.

## Rejected pre-fix art set

All customer facing gallery images were 1920 by 960.

| File | Size | SHA256 |
| --- | --- | --- |
| `1-hero.png` | 1920×960 | `ce639083a13d32fa14f87291b39a4e1bd4d67d5d6565c6dc5c651ffbdfd19833` |
| `2-showcase.png` | 1920×960 | `0e7cbab13b1a565c0a5e199a3d44710bee561dcc8ace247222d71a609a4b2219` |
| `3-features.png` | 1920×960 | `b142a77f588c3692038ee7cb0bc1e6c5aaa530306be7823abdf265b5a473184f` |
| `4-settings.png` | 1920×960 | `07f25463c72421ff1904cde2569b991fd91b359e652caa924a8b0bea51568708` |
| `5-sizes.png` | 1920×960 | `67290e9213b2c61c9399f3fc56c7b99aa1d41c7712f20844c7ffc18480d36786` |
| `icon-288x288.png` | 288×288 | `8f64bdbcbd3f19705f1593304ede1cef3de5f5e23224e8bfe1b809ab633b14e1` |
| `contact-sheet.jpg` | 1600×1320 | `10fab6309093291a56888a14f1e394119ba34f8ad8159a6c7c68361bde4ca236` |

## Provenance requirement for rerender

The replacement artwork must use the corrected packaged Now Playing widget and deterministic iCUE Media provider fixtures with fictional track and artist names.

The hero must composite the real corrected widget capture into the approved calibrated straight XENEON Edge device plate from the Rat Art v2 system.

No generated album art, progress bar, seek state, playback state, or third party music branding may be used.

The palette comparison must hold the fictional artist constant so Artist, Neon, Ember, and Ocean are compared without changing two variables at once.

## Preflight for replacement candidate

Required real corrected widget captures must exist before rendering.

Gallery images must be 1920 by 960 and search icon 288 by 288.

Exact brand font resolution must succeed with no silent fallback.

Calibrated XENEON device mapping must be used.

Unsupported Media provider capabilities must not be advertised.

No third party branding may be present.

Typography review must explicitly inspect descenders in `g`, `y`, `p`, `q`, and `j` when they appear in clipping or marquee viewports.

## Promotion rule

Do not promote any pre-fix candidate file listed above. Promotion is blocked until Rat Art rerenders from the corrected package, the replacement contact sheet is approved, and the new exact hashes are recorded here.
