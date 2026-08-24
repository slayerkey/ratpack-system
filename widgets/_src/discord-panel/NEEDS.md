# Discord Voice Panel needs

## Current transport

The widget no longer connects directly to Discord RPC and does not perform Discord OAuth.

Live path:

PackRat Discord Bridge on Stream Deck -> loopback WebSocket `ws://127.0.0.1:17483` -> Discord Voice Panel on XENEON Edge.

The companion loads Discord's official StreamKit voice overlay in a hidden Microsoft Edge process and forwards only normalized roster/speaking display state to the widget.

The widget sends only:

- Discord Server ID
- Discord Voice Channel ID
- optional local display label
- refresh command
- mute/deafen command

No Discord token, cookie, Client Secret, or StreamKit browser credential enters the XENEON package.

## Required user setup for feasibility build

1. Install/update the free PackRat Discord Bridge with `rat dev discord-bridge`.
2. Import this widget with `rat dev discord-panel`.
3. Enable Discord Developer Mode.
4. Copy Server ID into `Discord Server ID`.
5. Copy the target voice channel ID into `Voice Channel ID`.
6. Optionally name the channel with `Channel Label`.

## Current physical gate

On the real XENEON Edge prove:

- loopback WebSocket connects from the iCUE widget runtime
- configured StreamKit channel reaches ready state in the companion
- member roster renders
- active speaking changes animate/promote correctly
- mute touch reaches Discord
- deafen touch reaches Discord
- widget reconnects after Stream Deck or iCUE restart
- no viewport overflow across the physical slot used for the smoke test

The eight-size visual layout was already exercised with deterministic fixtures before this transport pivot. The roster UI and CSS were intentionally retained; after live transport feasibility passes, rerun the full eight-size release gate before shipping.

## Known limitation of this alternate path

The current feasibility build follows a configured Discord server/channel pair rather than automatically following whichever voice channel the user joins. Automatic current-channel following remains a possible future enhancement if Discord grants the restricted RPC voice scopes.
