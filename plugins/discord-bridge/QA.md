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

The user's `0.1.0.2` state proved `connected:true`, `ready:true`, `rpcVersion:1`, and `handshake:"ready"`.

## Remaining feasibility gate

Test build `0.1.0.4` with `rat dev discord-bridge`, press the Bridge Status key once, and inspect `/state` after the Discord RPC `AUTHORIZE` attempt.

If RPC AUTHORIZE itself is rejected, Discord partner approval is the current blocker.

If the authorization code is returned but public token exchange is rejected, a small PackRat server-side confidential exchange is required before the product can ship.
