# XENEON EDGE Ultimate QA

## Release status

The native-first release candidate completed the full RatPack automated XENEON gate at version `0.9.0` and is approved for promotion to `1.0.0`.

Validated candidate commit: `9da422b2a934e6e9df42633c0a4a52080166d9e0`.

## Verified release evidence

### Exact package and host gate

GitHub Actions run `33251723808` passed the complete canonical package path:

- source regenerated with `tools/xeneon/inline.py`
- official `icuewidget-cli@0.4.47` validation
- official `.icuewidget` creation
- exact ZIP/package integrity checks
- lexical iCUE Custom Style binding regression
- Corsair Labs `iCUE-widget-runner-windows` exact-package host/settings smoke
- packaged live HTTPS response-timing smoke
- all eight XENEON viewport compositions with no overflow, no multiple visible screens, no runtime errors and no touch targets below the product smoke minimum
- StreamSpell packaged-widget render across the supported XENEON presets

### Rat Art

GitHub Actions run `33251724779` passed:

- canonical shipping rebuild
- deterministic native captures across all eight XENEON compositions
- Home, Performance, Today and Ambient fixtures
- canonical Rat Art rendering
- Rat Art contract verification
- isolated candidate artifact upload

Visual review of the generated cover, feature breakdown, showcase, modes/presets frame and size-compatibility frame passed. The product remains readable, cohesive and visually differentiated at the wide XENEON form factor.

### Rat Ship

GitHub Actions run `33251725634` passed:

- local Rat command/parser validation
- official CORSAIR validation and package creation
- deterministic product captures and Rat Art
- deterministic 288x288 search icon
- Maker Console SHIP_KIT generation
- Playwright Maker Console driver preflight
- Rat Ship invariants, including non-duplicate listing media
- final ship-kit artifact upload

The shared XENEON ship-kit builder was also corrected to support the canonical bullet-list `release_notes` metadata format while preserving legacy prose compatibility.

## Static and API honesty gates

- Source head is XML-safe after RatPack inlining.
- Authored JavaScript passes syntax validation.
- No remote JavaScript or stylesheet dependencies.
- Custom Style triplet is `textColor`, `accentColor`, `backgroundColor` in canonical order.
- Required plugin declarations match documented iCUE provider module/plugin/version strings.
- Native telemetry is limited to data the iCUE providers actually expose.
- The product does not claim native 1% lows, true frametime, album art, media progress, ICMP ping or literal packet loss.
- Browser network measurements are explicitly described as HTTPS response timing.
- Weather and calendar fail closed when configuration or network access is unavailable.
- Preview and Rat Art fixtures never become shipping telemetry.

## Eight-slot layout contract

Validated compositions:

- 840x344 S horizontal
- 696x416 S vertical
- 840x696 M horizontal
- 696x840 M vertical
- 1688x696 L horizontal
- 696x1688 L vertical
- 2536x696 XL horizontal
- 696x2536 XL vertical

QA caught and corrected two real touchscreen issues before release: compact S-horizontal mode navigation and M-vertical Focus controls were initially below the minimum touch target. Both were enlarged and the strict packaged smoke subsequently passed all eight compositions.

## Runtime coverage

Verified or deterministically exercised states include sensor provider loading and CPU/GPU discovery, FPS availability and foreground process, Smart Mode entry/exit behavior, media metadata and transport wiring, configured/unconfigured weather, ICS agenda states, HTTPS network success/history, Focus controls, live style settings and local persistence.

## Remaining external confidence checks

A physical XENEON EDGE / real iCUE smoke remains useful extra confidence when available, especially for physical readability and touch feel. Under the current RatPack release contract it is not required for release-candidate status after the automated exact-package gates above pass.

Marketplace submission remains a separate authenticated action. Final product name, paid price and publication action must be explicitly verified in Maker Console before Submit.
