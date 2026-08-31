# Discord Bridge needs

## Engineering status

The companion is now a `1.0.0.0` release candidate and is `READY_TO_SHIP`.

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
- final Windows Bridge Status smoke after the SDK and memory-only credential changes
- external real-world Bridge + Voice Panel field test reported working successfully

No additional local engineering input is required for the release candidate. Do not repeat the Discord transport investigation unless the production identity path changes or a concrete regression appears.

If the Discord application identity or token exchange path is changed later, rerun the real Windows authorization/channel/roster/speaking/mute/deafen smoke after that change.

## Physical XENEON status

The combined Bridge + Voice Panel path has now been exercised by an external tester on real XENEON Edge hardware and was reported working successfully. The widget also passed the canonical no-hardware release tiers: source/structure checks, all-eight-size browser fixtures, official CORSAIR validate/package, packaged file-origin loopback testing through the actual companion bridge, crowded roster stress, and StreamSpell.

## Discord permission documentation

Discord RPC / StreamKit production-permission research remains documented in `DISCORD_APPROVAL.md` for reference.

On 2026-08-30 the operator explicitly elected **not** to treat that documentation question as a Marketplace release blocker for PackRat Voice Bridge or PackRat Voice Panel after successful real-world testing. This is not a claim of separate written Discord approval; it is the recorded release decision for these two products.

Do not automatically restore the old Discord approval blocker in a future run unless the operator reverses this decision or a concrete Discord / Marketplace rejection requires it.

## Marketplace paperwork

Review the current private Elgato Maker/Marketplace agreement for any companion-app or dependency disclosure requirements during authenticated submission. Technical Elgato SDK validation and packaging are complete.

## Release pairing

- PackRat Voice Bridge: free, `READY_TO_SHIP`
- PackRat Voice Panel: $7.99 one time, `READY_TO_SHIP`

Current submission command:

```powershell
rat ship discord-bridge discord-panel
```
