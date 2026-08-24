# Discord Bridge needs

## Proven locally on Windows

- Stream Deck plugin launches and survives normal restart/link cycles.
- The local PackRat bridge listens on `127.0.0.1:17483`.
- The companion connects to Discord through `\\?\\pipe\\discord-ipc-0`.
- Discord accepts the native IPC handshake and returns RPC v1 `READY`.
- The old browser/WebSocket `Origin` problem is bypassed by the companion architecture.
- Discord rejects this application's `rpc.voice.read` and `rpc.voice.write` request with `invalid_scope` before issuing an authorization code.

## Current feasibility path

The active spike no longer depends on those restricted voice scopes.

The companion launches Discord's official StreamKit voice overlay as a top-level page in a hidden Microsoft Edge process, reads the rendered roster and speaking state locally through Edge DevTools, and forwards normalized display state over the existing loopback bridge.

Mute and deafen use Discord's documented global Windows shortcuts instead of `rpc.voice.write`.

## What still needs physical proof

1. Run build `0.2.0.0` through `rat dev discord-bridge`.
2. Build/import the XENEON widget through `rat dev discord-panel`.
3. Configure the Discord Server ID and Voice Channel ID in iCUE.
4. Confirm the hidden official StreamKit page reaches `streamkit.stage: ready`.
5. Confirm the real roster appears on XENEON Edge.
6. Confirm speaking highlights update quickly enough for the panel experience.
7. Confirm mute and deafen touch controls reach Discord while Discord is in the background.
8. Confirm the helper survives Discord, Stream Deck, and iCUE restarts.

## If the StreamKit spike works

- replace PoC/raw Stream Deck host plumbing with current `@elgato/streamdeck` v2+ and SDKVersion 3 before Marketplace release
- harden StreamKit DOM change detection and add safe diagnostics for selector drift
- decide how many saved Discord channels the final companion should support
- decide whether channel label should be manual or discovered from the overlay
- package and validate the companion with the official Elgato CLI on a clean runner
- run the complete XENEON eight-size gate, official CORSAIR package, StreamSpell, Rat Art, and Rat Ship flow
- review current Marketplace/Maker terms for the local Edge helper before public submission

## Optional future enhancement

Discord partner approval for `rpc.voice.read` and `rpc.voice.write` would still be valuable because it could enable automatic current-channel following and richer state. It is no longer required for this alternate feasibility test.
