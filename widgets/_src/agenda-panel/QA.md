# Calendar Panel QA

Status: BUILDING

Product: Calendar Panel
Slug: `agenda-panel`
Branch: `product/agenda-panel`
Version: `1.0.0`
Author: `PackRat 🐀`

## Product behavior contract

- No OAuth.
- Up to three ICS feed URLs, stored only as iCUE textfield properties.
- Direct feed fetch first, loopback Calendar Sync Pro bridge fallback second.
- Cached parsed event data may persist per widget instance, but secret feed URLs are never copied into localStorage.
- Time-scaled day timeline uses actual local day start and next-day start, so 23-hour and 25-hour DST days do not assume 1440 minutes.
- All-day events use date-only semantics and exclusive DTEND.
- Recurring events expand within a bounded visible window and honor RDATE, EXDATE, RECURRENCE-ID overrides, cancellation, COUNT and UNTIL.
- IANA TZID, UTC, floating local time, and embedded VTIMEZONE STANDARD/DAYLIGHT rules are resolved before local display.
- Concurrent events are lane-packed. Overflow collapses instead of shrinking touch targets below useful size.
- Small and portrait slots use chronological agenda compositions rather than a compressed 24-hour axis.

## Automated checks completed

PASS: canonical `tools/xeneon/inline.py agenda-panel` generated the self-contained shipping HTML.

PASS: canonical inline `--check` reports the shipping HTML is current.

PASS: parser regression fixtures cover exclusive all-day DTEND, recurrence COUNT, EXDATE, RECURRENCE-ID replacement, floating local time, IANA timezone conversion, spring DST wall time, embedded VTIMEZONE daylight and standard offsets, and recurring wall-time conversion through an embedded timezone.

PASS: deterministic browser audit across all eight official XENEON sizes: 840x344, 696x416, 840x696, 696x840, 1688x696, 696x1688, 2536x696, and 696x2536.

PASS: zero document overflow, zero runtime or console errors, no visible interactive target below the tested 44 px floor, no offscreen visible interaction, and descender-heavy hero copy remains inside its card.

PASS: horizontal M, L, and XL render time-scaled event blocks. Small horizontal and all portrait slots render the chronological touch agenda instead of compressing the timeline.

PASS: the repeatable parser suite is committed under `qa/parser-fixtures.cjs` and the Playwright eight-slot verifier is committed under `qa/verify.mjs`.

## Remote automated checks still required

- Official CORSAIR `icuewidget-cli@0.4.47 validate`.
- Official `.icuewidget` package creation.
- Generic `tools/xeneon/streamspell.mjs` verification of that exact package across all eight presets.
- Deterministic Rat Art after the shared XENEON capture/art path is generalized beyond Now Playing fixtures.

The canonical XENEON CI already supports a manual `slug` input, so the first three checks should run as one GitHub Actions dispatch with `slug=agenda-panel`. The pull-request trigger currently defaults to `now-playing`, so a normal PR run is not evidence for Calendar Panel.

## Release blockers

See `NEEDS.md`.

The Calendar Sync Pro raw ICS loopback bridge remains required for providers whose secret ICS endpoint blocks `file://` CORS.

The exact legacy Calendar Sync parser source is still absent from canonical GitHub. The current product-local implementation now includes embedded VTIMEZONE handling and the known recurrence/all-day/timezone regression fixtures, but final release confidence still requires fixture comparison against the migrated legacy parser rather than claiming the source was recovered when it was not.
