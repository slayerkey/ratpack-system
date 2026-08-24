# PackRat Discord Bridge

Development companion for the PackRat Discord Voice Panel on XENEON EDGE.

## Architecture

Discord Desktop -> documented native Discord IPC -> Stream Deck plugin -> loopback-only PackRat bridge on `127.0.0.1:17483` -> XENEON widget.

The bridge never sends Discord voice state to PackRat servers. The local HTTP and WebSocket bridge rejects non-local web origins. No Discord Client Secret is embedded in the plugin.

## Stream Deck key states

The Bridge Status action uses its own key title for normal operational state. It intentionally does not use Stream Deck's warning triangle for expected states.

Possible titles include:

- `Open Discord`
- `Discord Starting`
- `Press to Authorize`
- `Authorize in Discord`
- `Finishing Setup`
- `Discord Approval`
- `Auth Blocked`
- `Auth Failed`
- `Discord Ready`
- the current voice channel name after authentication

Manual Stream Deck title editing remains enabled, so the property panel does not show `Title disabled`.

## Local development

Do not download ZIPs for normal iteration.

From the canonical RatPack checkout run:

```text
rat dev discord-bridge
```

The command fetches `origin/product/discord-bridge`, materializes it under `out/dev`, builds and tests the plugin, validates it with the official Stream Deck CLI, links the plugin into Stream Deck, restarts it, and opens the local state page.

Generated local development files stay under the ignored RatPack `out` directory.

## Current authorization experiment

Build `0.1.0.4` uses Discord RPC `AUTHORIZE` over the already-proven native IPC connection. The one remaining feasibility question is whether the resulting code can be exchanged safely without embedding a confidential Discord Client Secret. General public release also requires Discord approval for the restricted `rpc.voice.read` and `rpc.voice.write` scopes.
