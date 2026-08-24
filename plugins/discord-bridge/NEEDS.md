# Discord Bridge needs

## Current external gates

1. Prove Discord RPC `AUTHORIZE` for the application over native IPC with `rpc.voice.read` and `rpc.voice.write`.
2. Prove whether the returned one-time code can be exchanged using a safe public-client path without a Client Secret.
3. If Discord requires confidential exchange, design the smallest PackRat server-side token exchange. Never embed the Discord Client Secret in Stream Deck or XENEON code.
4. Obtain Discord approval for the restricted RPC voice scopes before general public release.

## Production hardening after feasibility

- migrate the host layer to current `@elgato/streamdeck` v2+ and current SDK requirements before Marketplace release
- run official Stream Deck CLI validate and pack on a clean runner
- review the current private Maker Agreement in Maker Console before submission
- connect the proven local bridge protocol to the production `discord-panel` XENEON widget
