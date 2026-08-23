# Calendar Panel shared needs

## Calendar Sync parser provenance

The original handoff required porting the working Calendar Sync parser instead of inventing a weaker calendar engine. The supplied Calendar Sync Pro project confirmed that its TypeScript layer imports the real parser from the missing sibling `plugins/_calendar/src/` tree.

The upload also supplied the exact ical.js 2.2.1 dependency and a built `plugin.js` containing the compiled shared parser behavior. Calendar Panel now ships that exact ical.js runtime as its primary parser using a deterministic product-local gzip plus base64 representation. `agenda-ical.js` ports the recovered production behavior for VTIMEZONE registration, recurring masters and exceptions, occurrence detail resolution, safety bounds, dedupe strategy, timezone fallback, cancellation handling, and `webcal://` normalization.

The original `_calendar` TypeScript wrapper remains absent from canonical GitHub. If it is later migrated, compare it fixture for fixture for provenance and maintenance consolidation. Its absence is no longer a release blocker for Calendar Panel because the exact production parser dependency and compiled behavior are now present and tested.

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
6. Reject non HTTP and non HTTPS upstream URLs after `webcal://` normalization.
7. Do not parse or normalize calendar data. The widget owns parsing so there is one calendar behavior model.

The supplied Calendar Sync Pro source has no localhost bridge. It fetches ICS inside the Stream Deck Node process, where browser CORS does not apply. Adding the loopback transport to the companion is outside this widget's allowed write boundary. Providers that allow direct browser CORS work without it; providers that block direct access require the companion.

## Shared Rat Art capture

The generic XENEON build and packaged verification path exists through `tools/xeneon/inline.py`, the official CORSAIR CLI workflow, and `tools/xeneon/streamspell.mjs`. The current pull request workflow resolves the product slug from the PR diff, so Calendar Panel can use the generic vendor pipeline without a manual workflow dispatch.

Calendar Panel also carries deterministic product-local parser, state, lifecycle, interaction, and eight-slot browser QA under `qa/`.

The remaining shared-tool gap is marketplace capture and composition. Current canonical `tools/art/capture_xeneon.mjs` and parts of `tools/art/rat_art.py` still contain Now Playing specific fixtures and copy. Calendar Panel must not edit shared tooling under this product boundary. The owner pass should generalize the XENEON art fixture contract so each widget can provide deterministic product-specific setup and capture selectors without copying the shared compositor.

## Network host policy

The current Widget API manifest does not define a `network_hosts` field. Calendar Panel therefore does not invent one in the product manifest. User-supplied calendar hosts are handled as configured ICS URLs, with loopback `127.0.0.1` used only for the optional companion bridge fallback.
