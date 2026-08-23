# Calendar Panel shared needs

## Legacy parser migration

The August 16 handoff says to port the working Calendar Sync ICS parser from `plugins/calendar/src/`, with the reusable implementation previously audited under `plugins/_calendar/src/` using `ical.js` 2.2.1. Those legacy plugin trees are not present in the current canonical `ratpack-system` repository or any currently exposed branch.

This product therefore preserves the audited behavior contract locally: RRULE and RDATE expansion, EXDATE removal, RECURRENCE-ID overrides, cancellation handling, exclusive all-day DTEND semantics, timezone-aware wall-clock conversion, bounded expansion, and dedupe by UID plus occurrence start. It now also resolves embedded VTIMEZONE STANDARD and DAYLIGHT rules for non-IANA TZIDs and carries regression fixtures for both sides of DST.

The owner should still migrate the exact legacy parser into canonical GitHub and compare fixture-for-fixture before final release. Do not claim the old source was ported until the source itself is available and compared.

## Calendar Sync Pro raw ICS bridge

XENEON widgets run from a `file://` origin and browser CORS applies. Major calendar providers such as Google can return valid secret ICS feeds without `Access-Control-Allow-Origin`, so a direct widget fetch cannot reliably read them.

Calendar Panel first attempts the user-provided URL directly. If that fails it attempts this local companion contract:

`GET http://127.0.0.1:38765/v1/ics?url=<percent-encoded-ics-url>`

Required bridge behavior:

1. Run only on loopback.
2. Return the raw ICS body unchanged on HTTP 200.
3. Return `Access-Control-Allow-Origin: *` so the XENEON `file://` widget may read it.
4. Never log or persist the secret ICS URL by default.
5. Apply an 8 second upstream timeout and a conservative response size limit.
6. Reject non-http and non-https upstream URLs.
7. Do not parse or normalize calendar data. The widget owns parsing so there is one calendar behavior model.

The current Calendar Sync Pro implementation was previously audited as having no localhost bridge. That companion change is outside this product's allowed write boundary and is a release dependency for providers whose ICS endpoint is not CORS-readable.

## Shared Rat Art capture

The generic XENEON build and packaged verification path already exists through `tools/xeneon/inline.py` and `tools/xeneon/streamspell.mjs`. Calendar Panel also carries its own deterministic parser and eight-slot browser QA under `qa/`.

The remaining shared-tool gap is marketplace capture and composition. Current canonical `tools/art/capture_xeneon.mjs` and parts of `tools/art/rat_art.py` still contain Now Playing-specific fixtures and copy. Calendar Panel must not edit shared tooling under this product boundary. Before Rat Art can be considered clean, the owner should generalize the XENEON art fixture contract so each widget can provide product-specific deterministic setup and capture selectors without copying the shared compositor.

Required Calendar Panel art/QA fixture cases include:

- weekly recurring event
- EXDATE removed occurrence
- RECURRENCE-ID moved occurrence
- cancelled occurrence
- one-day all-day event with exclusive DTEND
- multi-day all-day event
- explicit UTC event
- IANA TZID event
- embedded VTIMEZONE with non-IANA TZID
- floating local event
- DST transition day
- overlapping timed events
- malformed feed
- empty feed
- stale cached data
- bridge unavailable

## Network host policy

The product has user-supplied ICS hosts, so a static host allowlist cannot enumerate every valid calendar feed. The owner needs a canonical policy for user-configured URL properties. The only product-known host is loopback `127.0.0.1` for the optional companion bridge.
