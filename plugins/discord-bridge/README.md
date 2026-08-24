# PackRat Discord Bridge

Development companion for the PackRat Discord Voice Panel on XENEON Edge.

## Current feasibility architecture

Discord Desktop stays the user's normal voice client.

The active `0.3.0.0` feasibility path uses Discord StreamKit's public RPC identity over Discord's native desktop IPC:

1. Connect to Discord Desktop through the native `discord-ipc-*` named pipe.
2. Handshake using Discord StreamKit client ID `207646673902501888`.
3. Request `rpc`, `rpc.voice.read`, and `rpc.voice.write` through native RPC `AUTHORIZE`.
4. Exchange the one time authorization code at `https://streamkit.discord.com/overlay/token` by sending only `{ code }`. No Discord Client Secret is embedded.
5. Authenticate the native RPC session with the returned access token.
6. Follow the currently selected Discord voice channel automatically, subscribe to roster and speaking events, and read/write the user's mute and deafen settings.
7. Forward only the normalized local snapshot to XENEON over the loopback PackRat bridge at `127.0.0.1:17483`.

The XENEON widget never receives the StreamKit access token or a Discord Client Secret.

This is a feasibility implementation. Using Discord StreamKit's public application identity for a separate commercial Marketplace product still needs a release policy/terms review before shipping, even if the local technical test succeeds.

## Why this transport exists

The PackRat owned Discord application successfully reached the native Discord IPC `READY` handshake, but Discord rejected its `rpc.voice.read` and `rpc.voice.write` authorization request with `invalid_scope` before issuing a code.

A current open source Discord voice integration demonstrates that Discord StreamKit's public client ID and token exchange endpoint can perform the same native RPC voice flow without embedding a client secret. Build `0.3.0.0` tests that path directly.

The previous hidden Microsoft Edge/fixed-channel StreamKit overlay implementation remains only as experimental source fallback and is not part of the production build.

## Stream Deck key states

The Bridge Status action communicates normal state through its own title and does not use Stream Deck's warning triangle for expected states.

Typical titles:

- `Open Discord`
- `Press to Authorize`
- `Authorize in Discord`
- `Finishing Setup`
- `Auth Needs Help`
- `Discord Ready`
- the current voice channel name

## Local development

Do not download ZIPs for normal iteration.

```text
rat dev discord-bridge
```

Rat Dev fetches `origin/product/discord-bridge`, builds it, runs tests, validates it with the official Stream Deck CLI, replaces the linked development copy, restarts it, and opens:

```text
http://127.0.0.1:17483/state
```

The XENEON side can be built, officially validated, packaged, and opened for iCUE import with:

```text
rat dev discord-panel
```

Generated development files stay under the ignored RatPack `out` directory.

## Current physical gate

Run `rat dev discord-bridge`, press the Bridge Status key once if it says `Press to Authorize`, and approve the Discord prompt.

A successful bridge state should show:

- `buildVersion: 0.3.0.0`
- `streamkit.mode: public_rpc`
- `streamkit.stage: ready`
- `discord.ready: true`
- `discord.authenticated: true`

Then join any Discord voice channel. The bridge should automatically populate `channel`, `channel.voice_states`, `speaking`, and the current mute/deafen settings.

After that, run `rat dev discord-panel` and verify on the physical XENEON Edge that the same current channel, roster, speaking highlights, mute, and deafen controls stay in sync.
