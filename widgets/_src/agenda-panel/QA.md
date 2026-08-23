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
- HTTP, HTTPS and `webcal://` feeds are accepted. `webcal://` is normalized to HTTPS before fetch, matching Calendar Sync Pro.
- Direct feed fetch first, loopback Calendar Sync Pro bridge fallback second.
- Cached parsed event data may persist per widget instance, but secret feed URLs are never copied into localStorage.
- Time-scaled day timeline uses actual local day start and next-day start, so 23-hour and 25-hour DST days do not assume 1440 minutes.
- All-day events use date-only semantics and exclusive DTEND.
- The primary parser uses the exact `ical.js` 2.2.1 runtime supplied with Calendar Sync Pro and ports the parser behavior recovered from its shipped production bundle.
- VTIMEZONE components are registered with ICAL before event expansion.
- Recurring masters relate matching recurrence exceptions and expand through `getOccurrenceDetails`, with a 10,000 occurrence safety cap.
- Cancelled recurring exceptions are explicitly suppressed.
- Expansion uses the Calendar Sync production horizon: 12 hour lookback and 30 day lookahead, with a 200 event output cap and dedupe by UID plus occurrence start.
- Unsupported ICAL TZIDs that are valid IANA zones use the same `Intl.DateTimeFormat` fallback conversion recovered from Calendar Sync Pro.
- Concurrent events are lane-packed. Overflow collapses instead of shrinking touch targets below useful size.
- Small and portrait slots use chronological agenda compositions rather than a compressed 24-hour axis.

## Automated checks completed

PASS: canonical `tools/xeneon/inline.py agenda-panel` generated the self-contained shipping HTML with the exact ical.js runtime inlined.

PASS: canonical inline `--check` reports the shipping HTML is current.

PASS: JavaScript syntax and manifest, translation and submission JSON parse checks.

PASS: parser regression fixtures use the exact ICAL primary parser and cover exclusive all-day DTEND, recurrence COUNT, EXDATE, RECURRENCE-ID replacement, cancelled recurrence exceptions, floating local time, IANA timezone conversion, spring DST wall time, embedded VTIMEZONE daylight and standard offsets, and `webcal://` normalization.

PASS: deterministic browser audit on the current ICAL-generated HTML across all eight official XENEON sizes: 840x344, 696x416, 840x696, 696x840, 1688x696, 696x1688, 2536x696, and 696x2536.

PASS: zero document overflow, zero runtime or console errors, no visible interactive target below the tested 44 px floor, no offscreen visible interaction, and descender-heavy hero copy remains inside its card.

PASS: horizontal M, L, and XL render time-scaled event blocks. Small horizontal and all portrait slots render the chronological touch agenda instead of compressing the timeline.

PASS: repeatable parser and browser QA live under `qa/`.

## Remote automated checks still required

- Official CORSAIR `icuewidget-cli@0.4.47 validate`.
- Official `.icuewidget` package creation.
- Generic `tools/xeneon/streamspell.mjs` verification of that exact package across all eight presets.
- Deterministic Rat Art after the shared XENEON capture/art path is generalized beyond Now Playing fixtures.

The generic XENEON CI supports `slug=agenda-panel` through workflow dispatch, but the current GitHub connector does not expose a fresh workflow-dispatch mutation and the pull-request expression defaults to `now-playing`. The product source itself does not modify shared workflows to work around that boundary.

## Release blockers

See `NEEDS.md`.

The Calendar Sync Pro raw ICS loopback bridge remains required for providers whose secret ICS endpoint blocks `file://` CORS.

The original `_calendar` TypeScript source is still absent, but the uploaded Calendar Sync Pro distribution supplied its exact `ical.js` 2.2.1 dependency and shipped compiled parser behavior. Calendar Panel now uses those directly rather than guessing at recurrence/timezone semantics.
