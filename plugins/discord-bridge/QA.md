# Discord Bridge QA

Current feasibility build: `0.2.0.0`

## Proven before the StreamKit pivot

PASS: Stream Deck plugin process runs on the user's Windows host.

PASS: localhost PackRat bridge listens on `127.0.0.1:17483`.

PASS: plugin connects to `\\?\\pipe\\discord-ipc-0`.

PASS: Discord returns the native IPC `READY` handshake.

PASS: direct XENEON browser to legacy Discord WebSocket RPC is not viable because Discord returns Invalid Origin.

PASS: native RPC `AUTHORIZE` reaches Discord, which rejects `rpc.voice.read` and `rpc.voice.write` with `invalid_scope` before issuing a code for the current application.

## Current automated checks

PASS: Discord IPC framing is little endian and handles chunked frames.

PASS: WebSocket RFC 6455 handshake and masked browser frames.

PASS: bridge listens only on loopback.

PASS: XENEON-compatible local/file origins are accepted and normal remote web origins are rejected.

PASS: local `Origin: null` bridge connection and command delivery.

PASS: official StreamKit voice URL generation uses `streamkit.discord.com/overlay/voice/<guild>/<channel>`.

PASS: StreamKit DOM normalization preserves roster, order, speaking state, and self voice hints.

PASS: StreamKit DOM probe uses broad class substring selectors instead of a single generated CSS hash.

PASS: mute helper emits Discord's Ctrl Shift M shortcut.

PASS: deafen helper emits Discord's Ctrl Shift D shortcut.

PASS: normal connection states do not invoke Stream Deck warning overlays.

PASS: `UserTitleEnabled` remains true.

## Current physical feasibility gate

Run:

```text
rat dev discord-bridge
rat dev discord-panel
```

Configure the Discord Server ID and Voice Channel ID in the XENEON widget settings.

Then prove on the user's Windows host and physical XENEON Edge:

1. bridge state reports `buildVersion: 0.2.0.0`
2. `streamkit.mode` is `official_overlay_edge`
3. `streamkit.stage` reaches `ready`
4. roster members appear on XENEON
5. speaking state changes are visible on XENEON
6. mute touch toggles Discord
7. deafen touch toggles Discord
8. the companion recovers after Stream Deck or Discord restarts

If `streamkit.stage` never reaches `ready`, inspect `/state` before changing architecture again. The next debugging target is current StreamKit DOM/runtime behavior in the hidden Edge page, not Discord restricted OAuth.
