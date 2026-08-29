# XENEON Home Assistant recovery — 2026-08-28

## Trigger

A real iCUE user reports that Home Assistant Panel 1.0.1 accepts server/token/entity settings but does not recognize any entities across multiple domains.

The screenshot shows a LAN HTTP URL, a Long-Lived Access Token field, and a manual entity id. The token itself must never be committed, logged, or copied into QA.

## Canonical source status

`products/index.json` registers `home-assistant` / Home Assistant Panel as published, version 1.0.1.

As of this recovery, current `main` contains neither `widgets/_src/home-assistant/` nor `widgets/home-assistant/`. Repository code search and the accessible Slayerkey repository list do not reveal a separate Home Assistant source repository.

Do not recreate the published product identity from scratch. Locate the actual local published source/package before changing the product.

## Current transport diagnosis

The published settings guidance tells users to add `null` to Home Assistant CORS allowed origins. That strongly suggests the product calls the REST API directly from an imported `file://` widget.

Modern browsers normally serialize a `file:` document as the opaque CORS origin `null`. Home Assistant's current HTTP CORS setup accepts configured origin strings and includes `Authorization` among allowed CORS headers.

Home Assistant 2026.8 moved HTTP server settings into Settings > System > Network. Saving changes restarts Home Assistant, and an administrator must confirm the new settings within five minutes or Home Assistant automatically reverts them.

Because the REST call includes an Authorization header, it requires a CORS preflight. A missing/reverted `null` origin permission can therefore make every entity look broken before entity lookup ever occurs.

## Better transport candidate

Home Assistant officially exposes `/api/websocket`.

The WebSocket flow authenticates by sending the access token after connection and supports `get_states` plus live `state_changed` subscriptions. The current Home Assistant WebSocket HTTP handler does not use the configured REST CORS middleware.

This makes the native WebSocket API a strong candidate for the repaired published product if real iCUE proves it can connect from the imported widget. It would remove the fragile `null` REST CORS setup requirement and enable live push instead of polling.

## Diagnostic gate

The temporary `tools/xeneon/home-assistant-diagnostic/` widget tests, in real iCUE:

1. LAN reachability with an opaque no-CORS request.
2. REST API readability / CORS.
3. Bearer token authentication.
4. Exact entity lookup.
5. Home Assistant native WebSocket authentication + `get_states`.

The browser regression runs from a real `file://` document against deterministic local HTTP/WebSocket fixtures. It asserts that REST preflight sends `Origin: null`, that Authorization is preflighted, and that WebSocket can still succeed when REST CORS is intentionally denied.

No real user token is used in CI.

## Security

The support screenshot exposed a real Long-Lived Access Token. The user should revoke it immediately and create a fresh temporary token before further testing. Never attach screenshots containing tokens to issues or CI artifacts.

Allowing the CORS origin `null` is also broader than an ordinary named web origin. Prefer the authenticated WebSocket transport if physical iCUE proves it viable.
