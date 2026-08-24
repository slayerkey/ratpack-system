# Discord Bridge QA

Current build: `0.1.0.4`

## Automated checks

PASS: Discord IPC framing is little endian and handles chunked frames.

PASS: WebSocket RFC 6455 handshake and masked browser frames.

PASS: bridge listens only on loopback.

PASS: XENEON-compatible local/file origins are accepted and normal remote web origins are rejected.

PASS: local `Origin: null` bridge connection and command delivery.

PASS: OAuth helper does not send a Discord Client Secret.

PASS: Public Client token-exchange request is covered by deterministic fixture tests.

PASS: all JavaScript source parses and the package build completes.

PASS: ten Node tests pass in the current ChatGPT execution environment.

PASS: normal connection/auth states no longer call Stream Deck `showAlert`; state is communicated through the key title instead.

PASS: `UserTitleEnabled` is true so Stream Deck does not present the action as `Title disabled`.

## Proven on the user's Windows host

PASS: Stream Deck plugin process runs.

PASS: localhost bridge listens on port 17483.

PASS: plugin connects to `\\?\\pipe\\discord-ipc-0`.

PASS: Discord returns the native IPC `READY` handshake.

PASS: Rat Dev canonical updater builds, tests and validates build `0.1.0.4` from `origin/product/discord-bridge` without using Downloads.

PASS: official Stream Deck CLI validation succeeds locally.

Observed healthy pre-auth state:

- `buildVersion: 0.1.0.4`
- `discord.connected: true`
- `discord.ready: true`
- `discord.rpcVersion: 1`
- `discord.handshake: ready`
- `error: null`

## Current Discord authorization result

BLOCKED: native IPC `AUTHORIZE` with `rpc.voice.read` and `rpc.voice.write` returns:

`OAuth2 Error: invalid_scope: The requested scope is invalid, unknown, or malformed. (5000)`

The rejection happens before code exchange:

- `oauth.stage: failed`
- `oauth.codeReceived: false`
- `oauth.tokenExchangeAttempted: false`
- `oauth.tokenExchangeStatus: null`

This means the local transport, Stream Deck companion and Discord IPC handshake are not the blocker. Discord is rejecting the requested restricted voice scopes at the authorization boundary.

## Final development-only check before parking

Discord documents App Testers as the access path for unapproved RPC applications during development. Add the developer account explicitly under App Testers, accept the tester invitation if required, and retry once.

If an explicitly accepted App Tester still receives `invalid_scope`, stop local auth iteration. General public release requires Discord approval for `rpc.voice.read` and `rpc.voice.write` regardless.
