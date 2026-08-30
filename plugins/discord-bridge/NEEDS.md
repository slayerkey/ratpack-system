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
- final user-reported Windows Bridge Status smoke after the SDK and memory-only credential changes

No additional local engineering input is currently required for the release candidate. Do not repeat the entire Discord transport investigation unless the production Discord identity path changes or a concrete regression appears.

If Discord approval requires changing the application identity or token exchange path, rerun the real Windows authorization/channel/roster/speaking/mute/deafen smoke after that production change.

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

- PackRat Voice Bridge: free
- PackRat Voice Panel: $7.99 one time
