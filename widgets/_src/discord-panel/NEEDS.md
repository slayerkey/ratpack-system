# Discord Voice Panel needs

## Current transport

The XENEON widget does not connect directly to Discord and does not perform Discord OAuth.

Live path:

Discord Desktop -> PackRat Discord Bridge on Stream Deck -> loopback WebSocket `ws://127.0.0.1:17483` -> Discord Voice Panel on XENEON Edge.

The active companion feasibility build uses Discord StreamKit's public RPC identity over Discord native IPC. The companion owns authorization, token storage, current voice channel discovery, roster/speaking subscriptions, and mute/deafen RPC commands.

The XENEON package receives only normalized local state and sends local commands such as authorize, refresh, mute, and deafen. No Discord access token or Client Secret enters the widget.

## User setup for the feasibility build

1. Update the companion with `rat dev discord-bridge`.
2. Authorize once from the Stream Deck Bridge Status key if prompted.
3. Join any Discord voice channel.
4. Build/import the widget with `rat dev discord-panel`.

There is no Server ID or Voice Channel ID configuration in the active build. The panel should automatically follow the current Discord voice channel.

## Current physical gate

On the real XENEON Edge prove:

- loopback WebSocket connects from the iCUE widget runtime
- authenticated companion snapshot reaches the widget
- joining a Discord voice channel automatically changes the displayed channel
- member roster renders and updates as members join/leave
- speaking events animate/promote correctly
- mute touch changes Discord and the returned mute state
- deafen touch changes Discord and the returned deafen state
- leaving voice returns to the calm idle state
- switching voice channels updates without reconfiguring iCUE
- widget reconnects after Stream Deck, Discord, or iCUE restart
- no viewport overflow on the physical smoke-test slot

The eight-size visual layout was already exercised with deterministic fixtures before the transport pivot. The roster UI and CSS were intentionally retained. After live transport feasibility passes, rerun the complete eight-size release gate against the final transport before shipping.

## Release gates after feasibility

A technical StreamKit public RPC pass does not by itself make this release-ready. Before commercial release:

- confirm the final companion implementation is acceptable under current Discord/StreamKit terms
- migrate the companion to the current official Stream Deck SDK and release packaging requirements
- rerun all eight XENEON sizes and interaction fixtures
- run official CORSAIR validation/package and StreamSpell verification
- generate Rat Art from the final real widget render
- complete Rat Ship and Marketplace review

If using StreamKit's public application identity is not acceptable for third-party commercial distribution, keep the proven local architecture and obtain Discord voice-scope approval for a PackRat-owned application instead.
