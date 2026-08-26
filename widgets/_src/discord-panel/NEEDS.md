# Discord Voice Panel needs

## Release candidate state

Discord Voice Panel `1.0.0` is strongly validated and priced at `$7.99` one time.

Required PackRat Discord Bridge companion `1.0.0.0` is free.

Live path:

Discord Desktop -> PackRat Discord Bridge -> `ws://127.0.0.1:17483` -> Discord Voice Panel.

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
- speaking promotion/hold, member detail, joins/leaves, channel switching
- mute/deafen state and command mapping
- idle/auth/failure/disconnected/recovery states
- packaged `file://` localhost WebSocket test
- actual PackRat companion `LocalBridgeServer` integration
- forced disconnect and reconnect
- strict package/privacy audit
- StreamSpell package verification at all eight presets

## Companion state

The free companion has been migrated to official `@elgato/streamdeck` `2.1.2`, `SDKVersion: 3`, Node.js 24, a deterministic lockfile, bundled output, and official Elgato validate/pack release CI.

The same Discord transport was previously proven on the user's real Windows machine with native Discord IPC, authorization, current channel/roster, speaking state, and mute/deafen state.

Remaining engineering smoke: run the final companion `1.0.0.0` on the user's Windows Stream Deck installation once after the SDK migration and confirm the existing Discord path still reaches ready state and recovers after restart.

## Physical XENEON boundary

PackRat does not currently own a physical XENEON Edge. The canonical automated release tiers are complete. A physical import/touch/local-bridge smoke test is additional confidence if hardware becomes available, but is not a reason to keep iterating ordinary widget code.

## Commercial Discord blocker

Discord documents `rpc`, `rpc.voice.read`, and `rpc.voice.write` as approval-only scopes.

The current technical feasibility path uses Discord StreamKit's public application identity. Do not assume that identity can be used by a separate paid PackRat product in production.

Before public commercial release, satisfy one of these:

1. obtain approval for the required scopes on a PackRat-owned Discord application and switch the free companion to that approved identity; or
2. obtain explicit written confirmation from Discord that this third-party commercial use of the StreamKit public identity/token endpoint is permitted.

Anything less should be treated as not approved.

The companion repository includes `plugins/discord-bridge/DISCORD_APPROVAL.md` with the official support path and a prepared request template.

## Marketplace finishing work after Discord clearance

Once the Discord production identity is compliant:

1. rerun the real Windows companion smoke using the approved identity
2. rerun Discord Bridge Release QA
3. rerun Discord Panel Deep QA
4. review the current private Elgato Maker/Marketplace agreement for companion disclosure requirements
5. generate Rat Art from the final deterministic widget captures
6. run Rat Ship and submit the free companion plus `$7.99` XENEON product
