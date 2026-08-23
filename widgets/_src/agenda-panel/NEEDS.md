# Calendar Panel compatibility and provenance notes

## Calendar Sync parser provenance

The original handoff required porting the working Calendar Sync parser instead of inventing a weaker calendar engine. The supplied Calendar Sync Pro project confirmed that its TypeScript layer imports the real parser from the missing sibling `plugins/_calendar/src/` tree.

The upload also supplied the exact ical.js 2.2.1 dependency and a built `plugin.js` containing the compiled shared parser behavior. Calendar Panel ships that exact ical.js runtime as its primary parser using a deterministic product-local gzip plus base64 representation. `agenda-ical.js` ports the recovered production behavior for VTIMEZONE registration, recurring masters and exceptions, occurrence detail resolution, safety bounds, dedupe strategy, timezone fallback, cancellation handling, and `webcal://` normalization.

The original `_calendar` TypeScript wrapper remains absent from canonical GitHub. If it is later migrated, compare it fixture for fixture for provenance and maintenance consolidation. Its absence is not a Calendar Panel release blocker because the exact production parser dependency and compiled behavior are present and tested.

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

The supplied Calendar Sync Pro source has no localhost bridge. It fetches ICS inside the Stream Deck Node process, where browser CORS does not apply. Adding the loopback transport to that separate companion is outside this widget's allowed write boundary.

This is a provider compatibility extension, not a Calendar Panel build blocker. Direct-CORS-compatible ICS feeds work without the companion. Providers that block direct browser access require the companion transport.

## Rat Art and Rat Ship

No Calendar Panel shared-tool blocker remains here.

The current canonical art pipeline uses product-local `rat-art.mjs` for deterministic fixture setup and product-local `rat-art.json` for marketplace copy and composition choices. Calendar Panel now supplies both files. Rat Art successfully captured all eight native widget slots and rendered the full marketplace image set.

Rat Ship successfully rebuilt the widget, ran official CORSAIR validation and packaging, captured and rendered art, rendered the search icon, built the Maker Console ship kit, passed driver preflight, and passed final ship invariants.

## Network host policy

The current Widget API manifest does not define a `network_hosts` field. Calendar Panel therefore does not invent one in the product manifest. User-supplied calendar hosts are handled as configured ICS URLs, with loopback `127.0.0.1` used only for the optional companion bridge fallback.
