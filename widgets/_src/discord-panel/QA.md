# Discord Voice Panel QA

## Build state

Product: Discord Voice Panel

Slug: `discord-panel`

Branch: `product/discord-panel`

Manifest author: `PackRat 🐀`

Version: `1.0.0`

Price target: `$7.99` one time.

Required companion: PackRat Discord Bridge `1.0.0.0`, free.

Current state: XENEON release candidate. The widget and local companion transport are strongly validated without physical XENEON hardware. Public commercial release still depends on a compliant Discord RPC application identity/approval path.

## Canonical architecture

Discord Desktop -> PackRat Discord Bridge on Stream Deck -> `ws://127.0.0.1:17483` -> Discord Voice Panel on XENEON Edge.

The widget never connects directly to Discord and never stores Discord credentials.

The companion owns Discord IPC/RPC, authorization, current channel discovery, speaking events, and mute/deafen control. The widget consumes only normalized local state and sends local commands.

## Authoritative deep QA

The final no-hardware validation campaign passed the complete PackRat XENEON stack.

PASS: source transport regression.

PASS: canonical flattened shipping build.

PASS: official CORSAIR CLI validation.

PASS: official CORSAIR `.icuewidget` packaging.

PASS: all eight official XENEON viewport sizes against authored source.

PASS: all eight official XENEON viewport sizes against the unpacked official package.

PASS: zero document/body overflow across all eight sizes.

PASS: zero browser runtime exceptions and zero console errors.

PASS: required touch target sizing across every composition.

PASS: speaking animation/promotion and the 900 ms anti-jitter hold.

PASS: member details, joins, leaves, and automatic channel switching.

PASS: mute and deafen state/command mapping.

PASS: idle, authorization, authorization failure, disconnected, and recovery states.

PASS: delayed runtime regression detection caught and eliminated the stale fixed-channel timer.

## Crowded roster and input safety

PASS: 50-member roster stress on all eight source layouts.

PASS: 50-member roster stress on all eight packaged layouts.

PASS: every member remains reachable; short layouts scroll internally while XL Vertical can fit the complete roster.

PASS: long names, Unicode, emoji, multiple writing systems, and HTML/script-looking display names remain safe text.

PASS: reduced-motion mode disables speaking motion as intended.

PASS: iCUE text/accent/background settings and Recent Activity setting remain functional.

## Real companion bridge integration

The packaged XENEON widget is tested against the actual `LocalBridgeServer` implementation checked out from `product/discord-bridge`, not just a generic WebSocket mock.

PASS: official packaged `file://` widget connects to `127.0.0.1:17483` with the expected local origin behavior.

PASS: bridge snapshot renders the current channel and roster.

PASS: mute command crosses the actual companion bridge.

PASS: deafen command crosses the actual companion bridge.

PASS: speaking updates cross the bridge.

PASS: automatic channel switching crosses the bridge.

PASS: forced socket loss produces the disconnected state.

PASS: automatic reconnect occurs and a fresh `refresh` command restores live state.

## StreamSpell

PASS: StreamSpell loads the official CORSAIR package.

PASS: all eight official XENEON presets render successfully.

StreamSpell intentionally sandboxes network connections, so it is used for package/layout verification. The separate packaged file-origin test covers the localhost WebSocket transport.

## Package/privacy audit

PASS: shipping widget is flattened and self-contained.

PASS: no Discord Client Secret.

PASS: no Discord access token.

PASS: no Discord application Client ID in the XENEON package.

PASS: no obsolete direct Discord OAuth/RPC implementation.

PASS: no fixed Server ID or Channel ID configuration.

PASS: manifest remains interactive and uses exact author `PackRat 🐀`.

## Responsive measurements

| Slot | Viewport | Minimum mute/deafen target |
| --- | --- | --- |
| S horizontal | 840x344 | 72 px |
| S vertical | 696x416 | 72 px |
| M horizontal | 840x696 | 88 px |
| M vertical | 696x840 | 88 px |
| L horizontal | 1688x696 | 98 px |
| L vertical | 696x1688 | 102 px |
| XL horizontal | 2536x696 | 104 px |
| XL vertical | 696x2536 | 106 px |

## Real Discord proof

Before the Stream Deck SDK migration, the same companion Discord transport was proven on the user's real Windows/Discord environment:

PASS: native Discord IPC `READY`.

PASS: RPC authorization and authentication.

PASS: granted `rpc`, `rpc.voice.read`, and `rpc.voice.write` scopes through the technical StreamKit feasibility path.

PASS: current real voice channel and roster.

PASS: live speaking state.

PASS: real mute/deafen state.

The final companion has since migrated to the official Elgato SDK without changing `LocalBridgeServer` or the Discord IPC/RPC model. A final real-Windows `1.0.0.0` regression smoke remains recommended.

## Physical XENEON boundary

PackRat does not currently own a physical XENEON Edge. Canonical PackRat policy allows a release candidate without hardware after source, browser, official CORSAIR package, and StreamSpell tiers pass unless an untested transport remains.

The localhost transport is separately tested with the official package through the actual PackRat companion bridge. A real iCUE/XENEON smoke test remains additional confidence if hardware becomes available, not the place ordinary code/layout/package bugs should first be discovered.

## Commercial release boundary

The remaining blocker is external to XENEON QA: Discord documents the RPC voice scopes as approval-only. The technically proven StreamKit public identity should not be assumed commercially reusable by PackRat without explicit permission.

Public paid release should use either an approved PackRat-owned Discord application or written Discord confirmation allowing the StreamKit identity path.
