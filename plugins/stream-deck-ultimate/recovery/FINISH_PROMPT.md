# STREAM DECK ULTIMATE: POST-SUBMISSION HANDOFF

Stream Deck Ultimate v1.0.0.0 was **SUBMITTED to the Elgato Marketplace on 2026-09-02** at $14.99, category Productivity, auto-publish ON.

This public recovery copy intentionally omits the local machine's hardware serial and absolute user-specific paths. The functional acceptance conclusions and source recovery pointers are preserved below.

## Durable source recovery

The local acceptance bundle recorded `BUNDLE_INFO.sourceCommit = fc314e6f42fbe3e16da82a3af7aca75bda288e4f`. That commit still exists in `slayerkey/rp-system` and was used to recover the upstream authoring source.

The shipped v1.0.0.0 build contained seven post-build fixes that must remain applied to every future rebuild:

1. Correct `IMMDeviceCollection` IID in `bin/audio.ps1`.
2. Use `pluginUUID` as the context when switching Stream Deck profiles.
3. Map the Smart navigation key to the proper Smart artwork.
4. Limit App Volume process titles to 9 characters for key readability.
5. Handle encoder press via `dialDown`.
6. Handle `touchTap` as an App Volume press.
7. Support a configurable physical `micDevice` through audio, config, diagnostics, and onboarding.

The exact original patch is preserved in `UPSTREAM-PATCHES/ALL-FIXES.patch`. The canonical build also keeps accepted runtime overrides so regeneration cannot silently lose these fixes.

## Hardware acceptance already proven

The accepted v1.0.0.0 release was physically or directly validated for install/load, bundled profiles, key art, profile navigation, Smart App, window actions, clipboard, capture, routines, Setup, audio switching, microphone control, privacy-safe diagnostics, per-app audio write/restore, App Volume Current/Specific/WAITING/mute/property-inspector behavior, upgrade retention, and hidden worker processes.

Do not ask for those tests to be repeated without a concrete regression reason. Prefer headless harnesses for code-path verification.

## Important unresolved D1 behavior

The shipped profile packs contain a page-ID mismatch that produces a non-fatal log warning. An obvious attempt to rewrite the IDs caused total profile import failure. That attempted fix was deliberately not shipped. Preserve the accepted behavior unless a replacement is proven on real Stream Deck software.

## Marketplace review correction — 2026-09-04

Elgato requested white category and action icons inside the Stream Deck app. The corrected v1.0.0.0 reference package changes exactly 32 PNGs: 15 action icon pairs and the category icon pair. Key faces, profiles, runtime code, and Marketplace artwork are unchanged.
