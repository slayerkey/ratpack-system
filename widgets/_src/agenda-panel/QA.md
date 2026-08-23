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
- Timed events are displayed in the viewer local timezone.
- Concurrent events are lane-packed. Overflow collapses instead of shrinking touch targets below useful size.
- Small and portrait slots use chronological agenda compositions rather than a compressed 24-hour axis.

## Automated evidence still required

- Canonical inline build.
- JavaScript syntax and JSON parse checks.
- Deterministic recurrence/all-day/timezone fixtures.
- Browser runtime and overflow checks at all eight XENEON slot sizes.
- Official CORSAIR CLI validate and package.
- StreamSpell packaged widget verification across all eight presets.
- Generic deterministic XENEON Rat Art capture after the shared capture harness is generalized.

## Release blockers

See `NEEDS.md`. The Calendar Sync Pro raw ICS bridge is required for feeds whose provider blocks `file://` CORS, and the exact legacy Calendar Sync parser still needs canonical migration and fixture comparison before final release confidence.
