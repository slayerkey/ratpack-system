# PackRat Discord Bridge

Development companion for the PackRat Discord Voice Panel on XENEON Edge.

## Current feasibility architecture

Discord Desktop stays the user's normal voice client.

The companion uses two local paths:

1. A lightweight native Discord IPC handshake confirms that Discord Desktop is running.
2. The official Discord StreamKit voice overlay is loaded as a top-level page in a hidden Microsoft Edge process. The companion reads the rendered roster and speaking state locally through Edge DevTools and forwards only normalized voice display data over the PackRat loopback bridge on `127.0.0.1:17483`.

The XENEON widget never receives Discord OAuth tokens, cookies, or a Discord Client Secret.

Mute and deafen controls use Discord's Windows global shortcuts through the companion instead of requesting the restricted `rpc.voice.write` scope.

## Why this transport exists

The original native Discord RPC feasibility spike proved the named-pipe transport but Discord rejected `rpc.voice.read` and `rpc.voice.write` with `invalid_scope` before returning an authorization code. Those scopes are approval gated for this application.

The StreamKit feasibility path keeps the product name and UI unchanged while testing whether Discord's official voice overlay can supply the roster and speaker signal without those restricted application scopes.

## Stream Deck key states

The Bridge Status action communicates normal state through its own title and does not use Stream Deck's warning triangle for expected states.

Typical titles:

- `Open Discord`
- `Setup on XENEON`
- `Voice Starting`
- `Voice Needs Help`
- `Discord Ready`
- configured channel name

## Local development

Do not download ZIPs for normal iteration.

```text
rat dev discord-bridge
```

Rat Dev fetches `origin/product/discord-bridge`, builds it, runs tests, validates it with the official Stream Deck CLI, replaces the linked development copy, restarts it, and opens:

```text
http://127.0.0.1:17483/state
```

The XENEON side can be built and opened for iCUE import with:

```text
rat dev discord-panel
```

Generated development files stay under the ignored RatPack `out` directory.

## Current physical gate

Configure a Discord Server ID and Voice Channel ID in the Discord Panel widget settings, then verify on the real XENEON Edge:

- StreamKit reaches `stage: ready`
- roster appears
- speaking users highlight and promote correctly
- Mute toggles Discord
- Deafen toggles Discord
- no external PackRat service is required
