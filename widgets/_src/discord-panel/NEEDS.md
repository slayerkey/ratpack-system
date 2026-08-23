# Discord Voice Panel needs

## Resolved setup

Discord application Client ID: `1540927508302536724`.

Registered OAuth redirect supplied by the owner: `http://127.0.0.1`.

Requested scopes: `rpc.voice.read` and `rpc.voice.write` only.

## Release blockers

1. Re-probe ports 6463 through 6472 with the real Client ID and `Origin: null` on the owner's Discord desktop session.
2. Confirm the Discord application is configured as a Public Client.
3. Run the real Public Client PKCE flow from the XENEON widget runtime and confirm the Discord token endpoint accepts the widget's `Origin: null` browser request.
4. Obtain Discord approval for `rpc.voice.read` and `rpc.voice.write` before marketplace submission. Current Discord documentation marks these as approved-partner scopes, and WebSocket RPC is deprecated for new integrations, so Discord approval may still be the hard stop.

## Authentication path implemented

The product now implements a no-secret Public Client PKCE attempt before any hosted broker is considered.

1. Generate a fresh cryptographically random PKCE verifier in the widget.
2. Derive an S256 code challenge with `crypto.subtle`.
3. Send RPC `AUTHORIZE` with `client_id`, `response_type: code`, the exact registered redirect URI, the two voice scopes, and the PKCE challenge.
4. Exchange the returned authorization code at `https://discord.com/api/oauth2/token` with `client_id`, `redirect_uri`, and `code_verifier`, never a client secret.
5. Keep the resulting access token in memory only for the widget session.
6. Send that access token to RPC `AUTHENTICATE` and verify both required scopes before enabling controls.
7. If the token exchange is blocked by CORS, Public Client configuration, partner approval, or legacy RPC incompatibility, stop in a deliberate error state rather than weakening security.

Discord's current Social SDK documentation officially supports Public Client applications with PKCE and no client secret. Community Discord protocol documentation also reports PKCE fields on legacy RPC `AUTHORIZE`. The real application still has to prove that combination on the installed Discord client.

No client secret belongs in widget source under any outcome.

## Shared tooling requests

The canonical repository currently lacks the historical generic XENEON browser harness and shared runtime described by the older handoff. This product keeps the minimum runtime helpers local, matching the Now Playing migration precedent. Migrate and deduplicate only after clean-runner equivalence is proven.

Current shared XENEON CI and Rat Art/Rat Ship workflows contain Now Playing specific fixture, copy, and invariant assumptions. Generalize them before using the full shared release pipeline for `discord-panel`. Do not copy those assumptions into this product.

## Network hosts

Live RPC: `127.0.0.1` ports 6463 through 6472.

Public Client PKCE token exchange: `discord.com`.

Avatar images, when Discord supplies an avatar hash: `cdn.discordapp.com`. The UI has an initials fallback and does not depend on the CDN to remain usable.
