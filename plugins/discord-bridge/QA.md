# Discord Bridge QA

Current feasibility build: `0.3.0.0`

## Proven on the user's Windows host

PASS: Stream Deck plugin process runs.

PASS: localhost PackRat bridge listens on `127.0.0.1:17483`.

PASS: plugin connects to `\\?\\pipe\\discord-ipc-0`.

PASS: Discord returns the native IPC `READY` handshake with RPC v1.

PASS: direct XENEON browser to legacy Discord WebSocket RPC is not viable because Discord rejects the browser origin.

PASS: the PackRat-owned Discord application reaches native RPC authorization, but Discord rejects its `rpc.voice.read` and `rpc.voice.write` request with `invalid_scope` before issuing a code.

## StreamKit public RPC feasibility result

Build `0.3.0.0` no longer uses the PackRat Discord application for voice authorization.

The production build:

1. handshakes Discord native IPC with StreamKit client ID `207646673902501888`
2. requests `rpc`, `rpc.voice.read`, and `rpc.voice.write` through native RPC `AUTHORIZE`
3. exchanges the one time code at `https://streamkit.discord.com/overlay/token` by sending only `{ code }`
4. authenticates the same Discord IPC session with the returned access token
5. subscribes to current-channel, roster, speaking, and voice-setting events
6. uses `SET_VOICE_SETTINGS` for real mute and deafen control
7. forwards only normalized state to XENEON over the loopback bridge

The StreamKit token is stored only in Stream Deck global settings for local reuse and is never included in `/state` or XENEON snapshots. No Discord Client Secret is embedded.

### Real host proof on 2026-08-24

PASS: `rat dev discord-bridge` installed build `0.3.0.0` and the local status endpoint reported protocol `3` and `streamkit.mode: public_rpc`.

PASS: Discord native IPC connected through `discord-ipc-0` and reached `handshake: ready`.

PASS: StreamKit native RPC authorization succeeded instead of returning `invalid_scope`.

PASS: StreamKit token exchange succeeded and `tokenCached: true`.

PASS: Discord RPC `AUTHENTICATE` succeeded with `discord.authenticated: true` and `streamkit.stage: ready`.

PASS: granted scopes include `rpc`, `rpc.voice.read`, and `rpc.voice.write`.

PASS: while already in a real Discord voice channel, `/state` automatically populated the current voice channel and `voice_states` without any configured Server ID or Channel ID.

PASS: real local mute/deafen state populated as booleans.

PASS: live speaking state populated for the current voice member.

The core Discord-side feasibility question is therefore proven. Remaining physical work is the XENEON loopback/render/control test plus restart persistence checks.

## Automated coverage in source

PASS: Discord IPC little-endian framing and chunked decoding.

PASS: WebSocket RFC 6455 handshake and masked browser frames.

PASS: loopback-only bridge and XENEON local/file origin allowlist.

PASS: local `Origin: null` WebSocket command delivery.

PASS: exact StreamKit public client ID, RPC scopes, and token endpoint are fixture-tested.

PASS: StreamKit token exchange test verifies the request body contains only the one time authorization code and no client secret.

PASS: production plugin test verifies it uses StreamKit native RPC, `AUTHORIZE`, `GET_SELECTED_VOICE_CHANNEL`, and `SET_VOICE_SETTINGS`, and does not instantiate the hidden Edge fallback.

PASS: normal operational states communicate through the Stream Deck key title instead of warning overlays.

The old hidden Edge overlay and keyboard-shortcut helpers remain in source only as an experimental fallback. The deterministic production build does not copy them into the plugin package.

## Current physical XENEON gate

Run:

```text
rat dev discord-panel
```

Then prove on the physical XENEON Edge:

1. the iCUE widget connects to `ws://127.0.0.1:17483`
2. the current Discord voice channel appears automatically
3. real roster members render correctly
4. speaking changes animate and promote correctly
5. avatar rendering and initials fallback both remain valid
6. Mute touch changes Discord through RPC and the returned state updates
7. Deafen touch changes Discord through RPC and the returned state updates
8. changing Discord voice channels updates the panel automatically
9. the bridge/widget recover after normal Stream Deck, Discord, and iCUE restarts
10. cached StreamKit authentication survives a normal linked-plugin restart

## Release caveat

A successful technical spike does not by itself approve this mechanism for a commercial Marketplace product. Before release, review current Discord/StreamKit terms and Marketplace requirements for using StreamKit's public application identity from a third-party companion. If that usage is not acceptable, retain the technical result but use an approved PackRat identity or another compliant transport for production.
