# Discord Bridge needs

## Proven locally on Windows

- Stream Deck plugin launches and survives normal restart/link cycles.
- The local PackRat bridge listens on `127.0.0.1:17483`.
- The companion connects to Discord through `\\?\\pipe\\discord-ipc-0`.
- Discord accepts the native IPC handshake and returns RPC v1 `READY`.
- The old browser/WebSocket `Origin` problem is bypassed by the companion architecture.
- Discord rejects the PackRat-owned application's `rpc.voice.read` and `rpc.voice.write` request with `invalid_scope` before issuing an authorization code.

## Active feasibility path

Build `0.3.0.0` tests Discord StreamKit's public RPC identity instead of the PackRat application.

The companion uses StreamKit client ID `207646673902501888`, requests `rpc`, `rpc.voice.read`, and `rpc.voice.write` through native Discord IPC, exchanges the resulting one time code through `https://streamkit.discord.com/overlay/token`, then authenticates the IPC session.

No Discord Client Secret is embedded. The token is not sent to the XENEON widget or exposed through the local bridge state.

If this succeeds, the product regains the original experience rather than the fixed-channel fallback:

- automatically follows whichever Discord voice channel the user joins
- receives the real roster and speaking events
- reads actual mute/deafen state
- changes mute/deafen through Discord RPC

## What still needs real-machine proof

1. Run `rat dev discord-bridge` and confirm build `0.3.0.0` passes all local tests plus official Stream Deck validation.
2. Confirm StreamKit's client ID receives the Discord native IPC `READY` handshake on Windows.
3. Press the Bridge Status key and approve the Discord authorization prompt.
4. Confirm native `AUTHORIZE` returns a code rather than `invalid_scope`.
5. Confirm StreamKit's token endpoint accepts that code.
6. Confirm RPC `AUTHENTICATE` succeeds.
7. Join any voice channel and confirm current channel, roster, speaking events, and voice settings populate automatically.
8. Confirm real RPC mute and deafen controls work.
9. Confirm cached authentication works after restarting the linked Stream Deck plugin.
10. Run `rat dev discord-panel`, import the package into iCUE, and prove the same data/control loop on the physical XENEON Edge.

## After technical feasibility passes

- migrate the raw Stream Deck host layer to the current `@elgato/streamdeck` SDK and SDKVersion 3 before Marketplace release
- remove the obsolete hidden Edge/fixed-channel fallback if it is no longer needed
- package and validate the companion through the official Elgato release path
- rerun the complete XENEON eight-size gate against the final loopback transport
- run official CORSAIR package, StreamSpell, Rat Art, and Rat Ship
- review current Discord/StreamKit terms before relying on StreamKit's public application identity in a commercial third-party product
- review current Elgato Marketplace/Maker terms for the required free local companion

## Production alternative if StreamKit identity is not acceptable

The native IPC transport itself is already proven. If StreamKit's public identity is unsuitable for commercial release, the clean production path is to obtain the required Discord voice scope approval for a PackRat-owned application and reuse the same bridge/widget architecture.
