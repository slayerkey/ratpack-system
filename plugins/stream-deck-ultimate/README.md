# Stream Deck Ultimate — canonical recovered v1.0 source

This directory is the durable source-of-truth for the **hardware-accepted Stream Deck Ultimate 1.0.0.0** release and the Elgato review correction that makes all category/action-list icons white.

## Why this directory exists

The v1.0.0.0 build was finalized and submitted from a local hardware-acceptance workspace. Seven fixes were applied directly to the staged plugin after the older authoring pipeline had produced it, so regenerating from that older source would silently undo the accepted fixes.

The acceptance bundle recovered on 2026-09-04 identified the upstream authoring commit as:

`fc314e6f42fbe3e16da82a3af7aca75bda288e4f`

That commit still exists in `slayerkey/rp-system`, so the durable source here combines:

- the recoverable upstream authoring/build machinery (`authoring/`);
- the exact seven hardware-accepted runtime overrides (`runtime-overrides/`);
- the exact v1.0.0.0 Marketplace manifest (`release/manifest-v1.0.0.json`);
- the local acceptance handoff, patch, tests, and evidence (`recovery/`);
- a build-enforced Elgato white category/action icon pass (`scripts/whiten_manifest_icons.py`);
- a known-good corrected reference package (`reference/Stream-Deck-Ultimate-v1.0.0-white-icons.streamDeckPlugin`).

## Canonical rule

**Start all future Stream Deck Ultimate work from this directory.**

Do not regenerate a release directly from `authoring/prototype/` and ship it. `authoring/` is historical build support. The final build must apply `runtime-overrides/`, the v1.0 manifest, the key-art polish, and the white icon compliance pass.

## Current Marketplace correction

Elgato review feedback required the icons shown inside the Stream Deck app for the plugin category and actions to be white.

The corrected reference package changes only:

- 15 action icon base files and their `@2x` variants (30 PNGs)
- category icon base and `@2x` variants (2 PNGs)

All visible pixels in those 32 files are pure white while transparency is preserved. Key faces, profiles, runtime code, property inspectors, and Marketplace artwork are unchanged from the hardware-accepted v1.0.0.0 package.

Corrected package SHA-256:

`5f6d1c546c370113b0f02677934214d8af7ef958592409b2d991db555d8243bb`

Original submitted package SHA-256:

`70a2e807fda53fc021297839b5e7d4f258ca68c3940fa2fb9d6f16d1b2462373`

## Build

On Windows with Python, Node, PowerShell, and Elgato's Stream Deck CLI available:

```powershell
powershell -ExecutionPolicy Bypass -File .\plugins\stream-deck-ultimate\scripts\build-final.ps1
```

The script stages from the historical authoring source, builds App Volume, applies the accepted overrides, regenerates art/profiles, enforces white app-list icons, validates with Elgato's CLI, and packages to `plugins/stream-deck-ultimate/dist/`.

## Hardware acceptance

Do not casually repeat the already-proven hardware tests. The recovered acceptance record is in `recovery/FINISH_PROMPT.md`. In particular, preserve the intentionally-unresolved D1 profile page-ID behavior; the obvious attempted fix caused profile import failure and was deliberately not shipped.
