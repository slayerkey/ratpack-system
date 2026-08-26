# Discord Bridge needs

## Engineering status

The companion is now a `1.0.0.0` release candidate.

Completed:

- native Discord IPC transport proven on real Windows
- StreamKit RPC authorization/token/authentication proven on real Windows
- current voice channel discovery proven
- roster, speaking, mute, and deafen state proven
- real RPC mute/deafen control path implemented
- loopback bridge bound to `127.0.0.1:17483`
- official `@elgato/streamdeck` `2.1.2` migration
- manifest `SDKVersion: 3`
- Node.js 24 runtime
- deterministic locked dependencies
- obsolete raw Stream Deck host implementation removed
- obsolete browser OAuth, hidden Edge, and hotkey fallbacks removed
- Discord access token changed to session memory only
- regression tests forbid Stream Deck global-settings token persistence
- clean Windows dependency audit and automated tests
- official Elgato CLI validation
- official Elgato `.streamDeckPlugin` packaging
- XENEON deep QA through the real companion `LocalBridgeServer`

## Remaining manual regression smoke

Run the final `1.0.0.0` plugin on the user's Windows Stream Deck installation once and confirm:

1. `/state` reports `buildVersion: 1.0.0.0`.
2. Discord native IPC reaches `ready`.
3. one normal Discord authorization prompt succeeds when required.
4. `streamkit.stage` reaches `ready`.
5. joining/switching a voice channel updates `channel` automatically.
6. speaking state updates.
7. mute and deafen state/control still work.
8. a Discord reconnect works while the plugin process remains alive.
9. a plugin process restart returns to authorization-required rather than restoring a stored access token.

The last behavior is intentional: the current Discord access token is memory only and is never persisted through Stream Deck settings.

This is the only meaningful local engineering regression test remaining for the companion.

## Physical XENEON status

PackRat does not currently own a physical XENEON Edge. The widget has passed the canonical no-hardware release tiers: source/structure checks, all-eight-size browser fixtures, official CORSAIR validate/package, packaged file-origin loopback testing through the actual companion bridge, crowded roster stress, and StreamSpell.

A physical XENEON/iCUE smoke test is welcome if compatible hardware becomes available, but ordinary software/layout/package work should not wait on hardware.

## Commercial Discord gate

This is the remaining public-release blocker.

Discord documents `rpc`, `rpc.voice.read`, and `rpc.voice.write` as scopes available only to approved partners. The working technical path currently authenticates using Discord StreamKit's public application identity.

Do **not** treat that technical success as permission for a separate paid PackRat product.

Before public commercial release, satisfy one of these:

1. obtain Discord approval for the required RPC voice scopes on a PackRat-owned Discord application, then change the companion to that identity and approved token exchange path; or
2. obtain explicit written Discord confirmation that PackRat may use the StreamKit public application identity and `streamkit.discord.com/overlay/token` for this third-party commercial companion.

The second path should be considered unapproved unless Discord says so explicitly.

See `DISCORD_APPROVAL.md` for the support path and request template.

## Marketplace paperwork

Before final Marketplace submission, review the current private Elgato Maker/Marketplace agreement for any companion-app or dependency disclosure requirements. Technical Elgato SDK validation and packaging are already complete.

## Release pairing

- PackRat Discord Bridge: free
- PackRat Discord Voice Panel: $7.99 one time
