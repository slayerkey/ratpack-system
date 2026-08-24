# Discord Bridge needs

## Proven locally on Windows

- Stream Deck plugin launches and survives normal restart/link cycles.
- The local PackRat bridge listens on `127.0.0.1:17483`.
- The companion connects to Discord through `\\?\\pipe\\discord-ipc-0`.
- Discord accepts the native IPC handshake and returns RPC v1 `READY`.
- The old browser/WebSocket `Origin` problem is therefore bypassed by the companion architecture.

## Current external gate

Discord RPC `AUTHORIZE` with `rpc.voice.read` and `rpc.voice.write` is rejected before any OAuth code is issued:

`OAuth2 Error: invalid_scope: The requested scope is invalid, unknown, or malformed. (5000)`

Observed state in build `0.1.0.4`:

- `discord.ready: true`
- `oauth.codeReceived: false`
- `oauth.tokenExchangeAttempted: false`
- `oauth.lastError: invalid_scope ... (5000)`

Discord's current OAuth2 documentation marks both `rpc.voice.read` and `rpc.voice.write` as only available to approved partners. Its RPC documentation also states that unapproved applications are restricted to the application's tester list during development.

### One remaining development-only check

Before treating partner approval as the absolute development blocker, add the developer account explicitly under Discord Developer Portal -> App Testers, accept the tester invitation if Discord sends one, then retry RPC `AUTHORIZE` once.

This is worth testing because Discord explicitly documents App Testers as the development access path for unapproved RPC applications. It does not remove the production requirement: general public release still requires Discord approval for the restricted voice scopes.

If an explicitly accepted App Tester still receives `invalid_scope`, stop auth experiments. The product is blocked pending Discord approval for `rpc.voice.read` and `rpc.voice.write`.

## After Discord grants development access

1. Prove RPC `AUTHORIZE` returns a one-time code.
2. Prove whether that code can be exchanged using a safe public-client path without a Client Secret.
3. If Discord requires confidential exchange, design the smallest PackRat server-side token exchange. Never embed the Discord Client Secret in Stream Deck or XENEON code.
4. Authenticate RPC and prove `GET_SELECTED_VOICE_CHANNEL`, `GET_VOICE_SETTINGS`, `SET_VOICE_SETTINGS`, voice-state events and speaking events.
5. Connect the proven local bridge protocol to the production `discord-panel` XENEON widget.

## Production hardening after feasibility

- obtain Discord approval for the restricted RPC voice scopes before general public release
- migrate the host layer to current `@elgato/streamdeck` v2+ and current SDK requirements before Marketplace release
- run official Stream Deck CLI validate and pack on a clean runner
- review the current private Maker Agreement in Maker Console before submission
