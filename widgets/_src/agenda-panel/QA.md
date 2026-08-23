# Calendar Panel QA

Status: BUILDING

Product: Calendar Panel
Slug: `agenda-panel`
Branch: `product/agenda-panel`
Version: `1.0.0`
Author: `PackRat 🐀`

## Product behavior contract

* No OAuth.
* Up to three ICS feed URLs, stored only as iCUE textfield properties.
* Direct feed fetch first, loopback Calendar Sync Pro bridge fallback second.
* `webcal://` feeds are accepted and normalized to HTTPS for transport.
* Cached parsed event data may persist per widget instance, but secret feed URLs are never copied into localStorage.
* Time scaled day timeline uses actual local day start and next day start, so 23 hour and 25 hour DST days do not assume 1440 minutes.
* All day events use date only semantics and exclusive DTEND.
* Recurring events expand within a bounded visible window and honor RDATE, EXDATE, RECURRENCE ID overrides, cancellation, COUNT and UNTIL.
* IANA TZID, UTC, floating local time, and embedded VTIMEZONE STANDARD/DAYLIGHT rules are resolved before local display.
* Concurrent events are lane packed. Overflow collapses instead of shrinking touch targets below useful size.
* Small and portrait slots use chronological agenda compositions rather than a compressed 24 hour axis.

## Calendar Sync provenance

The supplied Calendar Sync Pro archive was inspected directly. Its source imports the shared `_calendar` implementation rather than containing that TypeScript tree, but its built plugin includes the compiled shared calendar behavior and its dependencies include the exact `ical.js` 2.2.1 runtime used by the production build.

That evidence was used to compare and strengthen Calendar Panel behavior, including VTIMEZONE handling, recurrence exceptions, dedupe behavior, safety bounds, cancellation handling, and `webcal://` transport normalization.

The committed Calendar Panel runtime remains the product local parser in `agenda-core.js` plus `agenda-recur.js`. An exact ICAL based comparison implementation was exercised successfully in the execution workspace, but the exact third party runtime is not claimed as part of the current committed shipping source.

## Automated checks completed

PASS: canonical `tools/xeneon/inline.py agenda-panel` generated self contained shipping HTML.

PASS: canonical inline `--check` reports the generated shipping HTML is current in the execution workspace.

PASS: parser regression fixtures cover exclusive all day DTEND, recurrence COUNT, EXDATE, RECURRENCE ID replacement, floating local time, IANA timezone conversion, spring DST wall time, embedded VTIMEZONE daylight and standard offsets, recurring wall time conversion through an embedded timezone, cancelled recurrence exceptions, and `webcal://` feed normalization.

PASS: deterministic browser audit across all eight official XENEON sizes: 840x344, 696x416, 840x696, 696x840, 1688x696, 696x1688, 2536x696, and 696x2536.

PASS: zero document overflow, zero runtime or console errors, no visible interactive target below the tested 44 px floor, no offscreen visible interaction, and descender heavy hero copy remains inside its card.

PASS: horizontal M, L, and XL render time scaled event blocks. Small horizontal and all portrait slots render the chronological touch agenda instead of compressing the timeline.

PASS: the repeatable parser suite is committed under `qa/parser-fixtures.cjs` and the Playwright eight slot verifier is committed under `qa/verify.mjs`.

PASS: current `manifest.json` contains every required Widget API 1.4.0 manifest field for this product and targets Windows `dashboard_lcd` with `interactive: true`.

## Automated checks still required

* Official CORSAIR `icuewidget-cli@0.4.47 validate`.
* Official `.icuewidget` package creation.
* Generic `tools/xeneon/streamspell.mjs` verification of that exact package across all eight presets.
* Deterministic Rat Art after the shared XENEON capture and art path is generalized beyond Now Playing fixtures.

The canonical XENEON CI supports a manual `slug` input and is already generic for the first three checks. The pull request trigger currently selects `now-playing`, so an ordinary PR run is not Calendar Panel vendor evidence.

## Release blockers

See `NEEDS.md`.

The Calendar Sync Pro raw ICS loopback bridge remains required for providers whose secret ICS endpoint blocks `file://` CORS.

The original shared `_calendar` TypeScript source is still absent. The supplied Calendar Sync Pro artifact gives strong production behavior evidence, but this document does not claim source level identity that cannot be proven.
