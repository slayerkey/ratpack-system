# PackRat Discord Bridge

Free Stream Deck companion for the PackRat Discord Voice Panel on XENEON Edge.

Current release candidate: `1.0.0.0`.

## What it does

Discord Desktop remains the user's normal voice client. The bridge runs locally and exposes only normalized voice state to the XENEON widget.

Live path:

1. Connect to Discord Desktop through the native `discord-ipc-*` named pipe.
2. Authorize the required Discord RPC voice scopes.
3. Follow the currently selected voice channel automatically.
4. Receive roster, speaking, mute, and deafen updates.
5. Apply mute and deafen changes through Discord RPC.
6. Serve the normalized local snapshot to XENEON at `ws://127.0.0.1:17483`.

The XENEON widget never receives a Discord access token or Client Secret.

## Stream Deck implementation

The release candidate uses the current official Node SDK:

- `@elgato/streamdeck` `2.1.2`
- manifest `SDKVersion: 3`
- Node.js `24`
- Stream Deck minimum `7.3`
- deterministic `package-lock.json`
- bundled single-file runtime at `bin/plugin.js`

The old custom Stream Deck host protocol, hidden Edge browser fallback, keyboard-shortcut fallback, and browser OAuth implementation have been removed from the release source tree.

Clean Windows CI runs locked dependency installation, dependency audit, automated tests, bundled build, official `streamdeck validate`, official `streamdeck pack`, and release artifact verification.

## Credential handling

The current Discord access token is session memory only.

The companion does not store the StreamKit access token in Stream Deck global settings, files, the XENEON widget, or the loopback snapshot. A plugin process restart can therefore require another normal Discord authorization step.

Automated release tests fail if Stream Deck global settings token persistence or the old persisted token key returns.

## Current Discord transport

The technically proven build uses Discord StreamKit's public RPC identity:

- client ID `207646673902501888`
- scopes `rpc`, `rpc.voice.read`, and `rpc.voice.write`
- one-time code exchange through `https://streamkit.discord.com/overlay/token`

No Discord Client Secret is embedded.

Real Windows testing proved native Discord IPC, authorization, token exchange, RPC authentication, current channel discovery, real `voice_states`, speaking state, mute/deafen state, and the required voice scopes.

This proves the product architecture. It does **not** by itself grant PackRat permission to commercially distribute a separate application using Discord StreamKit's application identity. See `DISCORD_APPROVAL.md` before public commercial release.

## Stream Deck key states

The Bridge Status action uses its title for expected states rather than warning overlays.

Typical titles:

- `Open Discord`
- `Press to Authorize`
- `Authorize in Discord`
- `Finishing Setup`
- `Auth Needs Help`
- `Discord Ready`
- the current voice channel name

## Local development

```text
rat dev discord-bridge
```

Rat Dev fetches `origin/product/discord-bridge`, installs locked dependencies when needed, builds and tests it, validates it with the official Stream Deck CLI, replaces the linked development copy, restarts it, and opens:

```text
http://127.0.0.1:17483/state
```

The XENEON product is developed separately with:

```text
rat dev discord-panel
```

## Release pairing and price

- PackRat Discord Bridge: **Free**
- PackRat Discord Voice Panel for XENEON Edge: **$7.99 one time**

The bridge is a companion dependency and discovery surface, not a separately paid product.

## Remaining release boundary

Engineering is release-candidate quality. Before public commercial submission, use a Discord-approved PackRat application identity for the restricted RPC scopes or obtain explicit written confirmation from Discord that this third-party StreamKit identity usage is permitted.

A real Windows smoke test of `1.0.0.0` after the SDK and memory-only credential changes is also recommended before Marketplace submission. Physical XENEON hardware remains an optional final smoke test because the widget has passed the full automated CORSAIR, browser, packaged, actual companion bridge, stress, and StreamSpell gates.
