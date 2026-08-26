# Discord Bridge QA

Current release candidate: `1.0.0.0`

## Real Windows Discord proof

The pre-release StreamKit RPC transport was proven on the user's Windows host before the Stream Deck SDK migration.

PASS: Stream Deck plugin process ran and the loopback bridge listened on `127.0.0.1:17483`.

PASS: the companion connected to `\\?\\pipe\\discord-ipc-0` and Discord returned native RPC v1 `READY`.

PASS: native StreamKit `AUTHORIZE` succeeded for `rpc`, `rpc.voice.read`, and `rpc.voice.write`.

PASS: the one-time code exchange succeeded and the access token was cached locally.

PASS: RPC `AUTHENTICATE` succeeded.

PASS: current Discord voice channel and real `voice_states` populated automatically without Server ID or Channel ID configuration.

PASS: real mute/deafen state populated.

PASS: live speaking state populated.

The architecture and Discord-side transport are therefore technically proven.

## Official Stream Deck SDK migration

Release candidate `1.0.0.0` migrated the companion away from the custom raw Stream Deck host protocol.

PASS: uses official `@elgato/streamdeck` `2.1.2`.

PASS: manifest uses `SDKVersion: 3`.

PASS: Node.js runtime is `24`.

PASS: supported Stream Deck manifest minimum is `7.3`.

PASS: Bridge Status is implemented as an official `SingletonAction`.

PASS: global token persistence uses official `streamDeck.settings` APIs.

PASS: wake recovery uses official `streamDeck.system.onSystemDidWakeUp`.

PASS: obsolete hidden Edge browser fallback, browser OAuth fallback, and keyboard shortcut fallback source/tests were removed.

PASS: output is bundled to one `bin/plugin.js` runtime.

PASS: release dependencies are committed in `package-lock.json` and CI installs them with `npm ci`.

## Clean Windows release CI

Authoritative migration gate passed on public GitHub Windows runners.

PASS: locked dependency installation.

PASS: `npm audit --audit-level=high` with zero reported vulnerabilities at validation time.

PASS: 11 automated tests.

PASS: bundled release build.

PASS: minimal distribution audit.

PASS: official Elgato `streamdeck validate`.

PASS: official Elgato `streamdeck pack` producing a `.streamDeckPlugin` artifact.

The automated tests cover Discord IPC framing, loopback WebSocket framing/origin policy, command delivery, exact StreamKit RPC identity/scopes/token exchange, official SDK migration requirements, and removal of obsolete fallbacks.

## XENEON integration proof

The Discord Panel deep QA tests the official packaged `.icuewidget` through the real `LocalBridgeServer` implementation from `product/discord-bridge`, not a generic mock server.

The authoritative XENEON campaign passed:

- all eight official XENEON dimensions on source and package
- 50-member crowded roster stress on all eight dimensions
- Unicode/emoji/pathological name safety
- appearance settings and reduced motion
- speaking promotion and hold behavior
- member join/leave and channel switching
- mute/deafen command mapping
- packaged `file://` widget to loopback bridge
- forced disconnect and reconnect
- official CORSAIR validation/package
- StreamSpell at all eight presets

## Security and privacy checks

PASS: local bridge binds only to `127.0.0.1`.

PASS: bridge rejects non-loopback clients and disallowed web origins.

PASS: XENEON receives no Discord access token.

PASS: no Discord Client Secret is embedded.

PASS: the release bundle is checked for `client_secret`.

PASS: the XENEON package contains no Discord application identity or direct Discord authorization logic.

## Remaining manual smoke test

Run the final `1.0.0.0` companion on the user's Windows Stream Deck installation and confirm the already-authorized Discord path still reaches `streamkit.stage: ready`, current channel discovery, speaking, mute, and deafen after the SDK migration.

This is a regression smoke test of the new Stream Deck host layer, not a new architecture feasibility test.

## Commercial release boundary

Discord documents `rpc`, `rpc.voice.read`, and `rpc.voice.write` as approval-only scopes. The currently proven path uses Discord StreamKit's application identity. Technical success does not itself grant PackRat permission to commercially distribute a separate application using that identity.

Public paid release remains blocked until either:

1. a PackRat-owned Discord application is approved for the required RPC voice scopes, or
2. Discord provides explicit written confirmation that the StreamKit public identity/token endpoint may be used by this third-party commercial companion.

See `DISCORD_APPROVAL.md`.
