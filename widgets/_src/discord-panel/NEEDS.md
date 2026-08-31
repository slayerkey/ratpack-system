# PackRat Voice Panel needs

## Release candidate state

PackRat Voice Panel `1.0.0` is strongly validated, priced at `$7.99` one time, and is `READY_TO_SHIP`.

Required PackRat Voice Bridge companion `1.0.0.0` is free and is also `READY_TO_SHIP`.

Live path:

Discord Desktop -> PackRat Voice Bridge -> `ws://127.0.0.1:17483` -> PackRat Voice Panel.

The XENEON widget performs no Discord OAuth and contains no Discord token, Client Secret, or application identity.

## Completed XENEON gates

- source transport regression
- flattened shipping build
- official CORSAIR validation and package
- all eight official XENEON sizes against source
- all eight official XENEON sizes against the official package
- 50-member stress at all eight sizes on source and package
- Unicode/emoji/pathological name safety
- reduced-motion and iCUE appearance settings
- stable member slots while speaking state changes
- smaller contained real Discord avatars with separate nameplate geometry
- member detail, joins/leaves, channel switching
- mute/deafen state and command mapping
- idle/auth/failure/disconnected/recovery states
- packaged `file://` localhost WebSocket test
- actual PackRat companion `LocalBridgeServer` integration
- forced disconnect and reconnect
- strict package/privacy audit
- StreamSpell package verification at all eight presets
- exact official package through the Corsair Labs Windows iCUE Widget Runner
- lexical iCUE binding regression covering real-host-style variable updates
- external tester field run on real XENEON Edge hardware reported working successfully

Latest stable-roster / avatar-layout Deep QA: run `33348380403`, **PASS**.
Latest Marketplace Kit: run `33348380455`, **PASS**.

## Companion state

The free companion uses official `@elgato/streamdeck` `2.1.2`, `SDKVersion: 3`, Node.js 24, a deterministic lockfile, bundled output, and official Elgato validate/pack release CI.

The Discord transport has been proven on real Windows with native Discord IPC, authorization, current channel/roster, speaking state, and mute/deafen state. The combined Bridge + Panel integration has also now been field-tested by an external XENEON tester and reported working successfully.

No additional local engineering smoke is required before Marketplace submission. If the Discord application identity or token exchange path is changed later, rerun the full real Windows authorization/channel/roster/speaking/mute/deafen smoke after that implementation change.

## Discord permission documentation

The earlier Discord RPC / StreamKit production-permission investigation remains in `plugins/discord-bridge/DISCORD_APPROVAL.md` for reference.

On 2026-08-30 the operator explicitly elected **not** to treat that documentation question as a Marketplace release blocker for Voice Bridge or Voice Panel after successful real-world testing. This does not assert separate written Discord approval; it records the shipping decision for these two products.

Do not automatically restore the old Discord approval blocker unless the operator reverses this decision or a concrete Discord / Marketplace rejection requires it.

## Marketplace finishing work

Engineering and package gates are complete. The remaining normal release operation is authenticated Marketplace submission:

```powershell
rat ship discord-bridge discord-panel
```

Rat Ship should regenerate/verify the current deterministic kit from canonical `main` and proceed to Maker Console. If a new error occurs, troubleshoot that concrete submission error rather than reinstating the retired Discord permission blocker automatically.
