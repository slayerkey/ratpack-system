# Calendar Panel shared needs

## Calendar Sync parser provenance

The original handoff required porting the working Calendar Sync parser instead of rewriting it. The uploaded Calendar Sync Pro source confirmed that its TypeScript layer imports the real parser from the missing sibling `plugins/_calendar/src/` tree.

The upload also included two pieces that make the widget implementation materially stronger even though that sibling TypeScript source is still absent:

1. The exact `ical.js` 2.2.1 dependency tree shipped with Calendar Sync Pro.
2. The production `plugin.js` bundle containing the compiled shared parser behavior.

Calendar Panel now vendors that exact `ical.js` 2.2.1 ES5 browser runtime and ports the recovered production behavior: VTIMEZONE registration, master/exception separation, exception relation, ICAL recurrence iteration, occurrence detail resolution, a 10,000 occurrence safety cap, 12 hour lookback, 30 day lookahead, 200 event cap, dedupe by UID plus occurrence start, and the Intl fallback for IANA TZIDs not registered in ICAL.

Calendar Panel additionally suppresses cancelled recurrence exceptions explicitly. Regression fixtures cover this behavior.

If the original `_calendar` TypeScript source is later migrated into canonical GitHub, compare it fixture-for-fixture, but the widget is no longer relying on a guessed recurrence engine.

## Calendar Sync Pro raw ICS bridge

XENEON widgets run from a `file://` origin and browser CORS applies. Major calendar providers can return valid secret ICS feeds without `Access-Control-Allow-Origin`, so direct widget fetch cannot reliably read every provider.

Calendar Panel first attempts the configured feed directly. It accepts HTTP, HTTPS and `webcal://`; `webcal://` is normalized to HTTPS before network access, matching Calendar Sync Pro.

If direct access fails, Calendar Panel attempts this local companion contract:

`GET http://127.0.0.1:38765/v1/ics?url=<percent-encoded-ics-url>`

Required bridge behavior:

1. Run only on loopback.
2. Return the raw ICS body unchanged on HTTP 200.
3. Return `Access-Control-Allow-Origin: *` so the XENEON `file://` widget may read it.
4. Never log or persist the secret ICS URL by default.
5. Apply an upstream timeout and conservative response size limit.
6. Reject non-http and non-https upstream URLs.
7. Do not parse or normalize calendar data. The widget owns parsing so there is one calendar behavior model.

The supplied Calendar Sync Pro source has no localhost bridge. It fetches ICS inside the Stream Deck Node process, where browser CORS does not apply. Adding the loopback transport to the companion is outside this widget's allowed write boundary and remains a release dependency for CORS-blocked providers.

## Shared Rat Art capture

The generic XENEON build and packaged verification path already exists through `tools/xeneon/inline.py` and `tools/xeneon/streamspell.mjs`. Calendar Panel carries its own deterministic parser and eight-slot browser QA under `qa/`.

The remaining shared-tool gap is marketplace capture and composition. Current canonical `tools/art/capture_xeneon.mjs` and parts of `tools/art/rat_art.py` still contain Now Playing-specific fixtures and copy. Calendar Panel must not edit shared tooling under this product boundary. Before Rat Art can be considered clean, the owner pass should generalize the XENEON art fixture contract so each widget can provide product-specific deterministic setup and capture selectors without copying the shared compositor.

## Network host policy

The product has user-supplied ICS hosts, so a static host allowlist cannot enumerate every valid calendar feed. The canonical structure policy still needs an owner-level rule for user-configured URL properties. The only product-known host is loopback `127.0.0.1` for the optional companion bridge.
