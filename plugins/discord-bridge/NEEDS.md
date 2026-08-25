# Discord Bridge needs

## Proven locally on Windows

- Stream Deck plugin launches and survives normal restart/link cycles.
- The local PackRat bridge listens on `127.0.0.1:17483`.
- The companion connects to Discord through `\\?\\pipe\\discord-ipc-0`.
- Discord accepts the native IPC handshake and returns RPC v1 `READY`.
- The old browser/WebSocket `Origin` problem is bypassed by the companion architecture.
- Discord rejects the PackRat-owned application's `rpc.voice.read` and `rpc.voice.write` request with `invalid_scope` before issuing an authorization code.

## StreamKit public RPC path is technically proven

Build `0.3.0.0` uses Discord StreamKit's public RPC identity instead of the PackRat application.

The companion uses StreamKit client ID `207646673902501888`, requests `rpc`, `rpc.voice.read`, and `rpc.voice.write` through native Discord IPC, exchanges the resulting one time code through `https://streamkit.discord.com/overlay/token`, then authenticates the IPC session.

Real Windows host proof now confirms:

- native StreamKit `AUTHORIZE` succeeds
- StreamKit token exchange succeeds
- RPC `AUTHENTICATE` succeeds
- the granted scope set contains `rpc`, `rpc.voice.read`, and `rpc.voice.write`
- the access token is cached locally in Stream Deck settings
- the current Discord voice channel is discovered automatically
- real `voice_states` populate without Server ID or Channel ID configuration
- real mute/deafen state populates
- speaking state arrives live

No Discord Client Secret is embedded. The token is not sent to the XENEON widget or exposed through the local bridge state.

The original product experience is therefore technically viable:

- automatically follows whichever Discord voice channel the user joins
- receives the real roster and speaking events
- reads actual mute/deafen state
- changes mute/deafen through Discord RPC

## What still needs physical proof

1. Run `rat dev discord-panel` and import the fresh widget package into iCUE.
2. Confirm the real XENEON runtime can connect to the loopback bridge.
3. Confirm current channel and roster render on the physical Edge.
4. Confirm speaking highlights update quickly and reorder correctly.
5. Confirm Mute touch changes Discord and returned state updates.
6. Confirm Deafen touch changes Discord and returned state updates.
7. Switch between Discord voice channels and confirm the panel follows automatically.
8. Restart the linked Stream Deck plugin and confirm cached StreamKit authentication reconnects without another consent prompt.
9. Restart Discord and iCUE and confirm normal recovery.

## After physical feasibility passes

- migrate the raw Stream Deck host layer to the current `@elgato/streamdeck` SDK and SDKVersion 3 before Marketplace release
- remove obsolete hidden Edge/fixed-channel fallback source if no longer needed
- package and validate the companion through the official Elgato release path
- rerun the complete XENEON eight-size gate against the final loopback transport
- run official CORSAIR package, StreamSpell, Rat Art, and Rat Ship
- review current Discord/StreamKit terms before relying on StreamKit's public application identity in a commercial third-party product
- review current Elgato Marketplace/Maker terms for the required free local companion

## Production alternative if StreamKit identity is not acceptable

The native IPC transport itself is already proven. If StreamKit's public identity is unsuitable for commercial release, the clean production path is to obtain the required Discord voice scope approval for a PackRat-owned application and reuse the same bridge/widget architecture.
