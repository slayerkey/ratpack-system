# Discord Bridge QA

Current feasibility build: `0.3.0.0`

## Proven on the user's Windows host

PASS: Stream Deck plugin process runs.

PASS: localhost PackRat bridge listens on `127.0.0.1:17483`.

PASS: plugin connects to `\\?\\pipe\\discord-ipc-0`.

PASS: Discord returns the native IPC `READY` handshake with RPC v1.

PASS: direct XENEON browser to legacy Discord WebSocket RPC is not viable because Discord rejects the browser origin.

PASS: the PackRat-owned Discord application reaches native RPC authorization, but Discord rejects its `rpc.voice.read` and `rpc.voice.write` request with `invalid_scope` before issuing a code.

## Active StreamKit public RPC feasibility path

Build `0.3.0.0` no longer uses the PackRat Discord application for voice authorization.

The production build now:

1. handshakes Discord native IPC with StreamKit client ID `207646673902501888`
2. requests `rpc`, `rpc.voice.read`, and `rpc.voice.write` through native RPC `AUTHORIZE`
3. exchanges the one time code at `https://streamkit.discord.com/overlay/token` by sending only `{ code }`
4. authenticates the same Discord IPC session with the returned access token
5. subscribes to current-channel, roster, speaking, and voice-setting events
6. uses `SET_VOICE_SETTINGS` for real mute and deafen control
7. forwards only normalized state to XENEON over the loopback bridge

The StreamKit token is stored only in Stream Deck global settings for local reuse and is never included in `/state` or XENEON snapshots. No Discord Client Secret is embedded.

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

## Current real-machine gate

Run:

```text
rat dev discord-bridge
```

Rat Dev must pass the product build, all Node tests, and official Stream Deck CLI validation before linking build `0.3.0.0`.

Expected pre-authorization state:

- `buildVersion: 0.3.0.0`
- `protocol: 3`
- `streamkit.mode: public_rpc`
- `discord.ready: true`
- `discord.authenticated: false`

Press the Stream Deck Bridge Status key once if it says `Press to Authorize`.

A technical feasibility pass requires:

- Discord accepts StreamKit RPC `AUTHORIZE`
- StreamKit token endpoint returns an access token
- Discord RPC `AUTHENTICATE` succeeds
- `/state` shows `streamkit.stage: ready`
- `/state` shows `discord.authenticated: true`
- joining any Discord voice channel automatically populates `channel.voice_states`
- `speaking` changes on real speech
- mute/deafen commands update Discord and the returned voice state
- cached authentication survives a normal Stream Deck plugin restart

## Release caveat

A successful technical spike does not by itself approve this mechanism for a commercial Marketplace product. Before release, review current Discord/StreamKit terms and Marketplace requirements for using StreamKit's public application identity from a third-party companion. If that usage is not acceptable, retain the technical result but use an approved PackRat identity or another compliant transport for production.
