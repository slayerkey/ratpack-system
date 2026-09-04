# Stream Deck Ultimate — canonical recovered v1.0 source

This directory is the durable source-of-truth for the **hardware-accepted Stream Deck Ultimate 1.0.0.0** release and the Elgato review correction requiring white category/action-list icons.

## What was recovered

The final v1.0.0.0 build was completed in a local hardware-acceptance workspace and submitted to Elgato. Seven hardware fixes were made after the older authoring pipeline had staged the plugin, so rebuilding directly from the older prototype would silently reintroduce those defects.

The acceptance bundle identified the upstream authoring commit as:

`fc314e6f42fbe3e16da82a3af7aca75bda288e4f`

That commit still exists in `slayerkey/rp-system`. This recovery therefore preserves both sides of the product:

- `authoring/` — recovered historical source/build machinery from the recorded upstream commit;
- `accepted-source/` — recovered App Volume source used by the accepted runtime;
- `recovery/` — sanitized acceptance notes, tests and hardware evidence;
- `release/manifest-v1.0.0.json` — the final v1.0 Marketplace manifest contract;
- `reference/Stream-Deck-Ultimate-v1.0.0-white-icons.streamDeckPlugin` — the exact hardware-accepted v1.0 runtime with only Elgato's white-icon review correction applied;
- `scripts/` — deterministic materialization/validation helpers for that exact reference package.

## Canonical rule

**Start all future Stream Deck Ultimate work from this directory.**

For the accepted v1.0 release, the immutable baseline is the reference `.streamDeckPlugin`. It is a ZIP-format bundle containing the complete final runtime: JavaScript, HTML, PowerShell, App Volume helper, dependency files, profiles and image assets. `scripts/build-final.ps1` materializes that exact package and validates it; it does **not** regenerate v1 from the older prototype.

`authoring/` is retained so future feature work still has the original source history and test/build machinery, but it must not be treated as a byte-equivalent copy of the accepted v1 runtime.

## Seven hardware fixes preserved in the accepted baseline

1. Correct `IMMDeviceCollection` IID in `bin/audio.ps1`.
2. Use `pluginUUID` as the context for `switchToProfile`.
3. Render the Smart navigation key with the Smart artwork.
4. Limit App Volume process titles to 9 characters for 72px readability.
5. Handle encoder activation on `dialDown`.
6. Handle `touchTap` as an encoder press.
7. Add configurable physical `micDevice` targeting through audio, config, diagnostics and onboarding.

The recovered reference package contains all seven. This is the guard against a future authoring rebuild silently losing them.

## Elgato review correction — 2026-09-04

Elgato requested that the icons shown inside the Stream Deck app for the plugin category and actions be white.

The corrected reference package differs from the submitted v1.0.0.0 package in exactly **32 PNG files**:

- 15 action icon base files and their `@2x` variants (30 PNGs)
- category icon base and `@2x` variants (2 PNGs)

Every visible pixel in those 32 assets is pure `#FFFFFF`, with transparency preserved. Runtime code, profiles, key faces, property inspectors and Marketplace artwork are unchanged.

Corrected package SHA-256:

`5f6d1c546c370113b0f02677934214d8af7ef958592409b2d991db555d8243bb`

Original submitted package SHA-256:

`70a2e807fda53fc021297839b5e7d4f258ca68c3940fa2fb9d6f16d1b2462373`

## Build / validate

On Windows with Python and Elgato's Stream Deck CLI available:

```powershell
powershell -ExecutionPolicy Bypass -File .\plugins\stream-deck-ultimate\scripts\build-final.ps1
```

This extracts the exact known-good reference runtime, verifies the 32 white app-list icons, verifies the v1 manifest contract, runs official Elgato validation, and repacks to `plugins/stream-deck-ultimate/dist/`.

## Hardware acceptance

Do not casually repeat already-proven hardware tests. The sanitized acceptance summary is in `recovery/FINISH_PROMPT.md`. In particular, preserve the intentionally unresolved profile page-ID behavior: the obvious attempted repair caused full profile-import failure and was deliberately not shipped.
