# Stream Deck Ultimate v0.8 final pre-hardware checkpoint

Date: 2026-09-01 UTC

This is the short recovery checkpoint to use if conversation/tool context is lost. The larger history remains in `STREAM_DECK_ULTIMATE_V08_PREPROMOTION_CHECKPOINT_2026-08-30.md`.

## Bottom line

All useful software-only work for App Volume v0.8 is finished. The remaining blockers are intentionally physical hardware acceptance gates.

Do not install the integrated production-UUID v0.8 candidate before those gates pass.

Canonical production is still frozen at v0.7.1:

- UUID `com.packrat.stream-deck-ultimate-bundle`
- Version `0.7.1.0`
- CodePath `bin/plugin-v071.cjs`
- 15 actions
- 8 profile declarations

Canonical path:

`products/stream-deck-ultimate-bundle/prototype/com.packrat.stream-deck-ultimate-bundle.sdPlugin`

## Approved runtime anchor

Hardware approval remains pinned to:

- source commit `15cc99c96bf243dfccb0b18774e859882c97684b`
- packed v0.8 plugin SHA256 `a3790e672ce18bc9887d1b8b2f0175c663c548a4d4bad19c287f1cf2003d9497`

Later commits only add/test release safety, compatibility, documentation, and hardware-test convenience. Production-relevant App Volume source is guarded against drifting from that anchor.

## Automated v0.8 prepromotion proof

Fixture-aware full run:

- run `33458732654`
- Windows `99704166947` success
- Ubuntu validate/pack `99704307514` success

Proves:

- all frozen legacy logic/runtime regressions
- Smart Context compatibility
- diagnostics privacy compatibility
- legacy + App Volume in one multiplexed process
- lazy App Volume worker
- seeded v0.7.1 state compatibility
- real release art/profile generation
- 8 profiles
- 16 actions
- source-free helper packaging
- official Elgato validation
- official Elgato packing

## Upgrade baseline survives promotion

Frozen accepted manifest fixture:

`products/stream-deck-ultimate-bundle/experiments/per-app-audio/accepted-v071-manifest-contract.json`

Fixture commit:

`c5c6ec040703114ba52e48de425ac9c932a1e4a3`

Upgrade regression:

`products/stream-deck-ultimate-bundle/experiments/per-app-audio/upgrade-regression-v08.js`

Fixture-aware commit:

`b2c0a6cd68fdefe7e83fa61623536720f074feab`

If canonical is still v0.7.1, the test uses canonical as the baseline. Once canonical becomes v0.8, the same test automatically uses the frozen v0.7.1 fixture.

## Production upgrade gate is already waiting

Workflow:

`.github/workflows/stream-deck-ultimate-v08-production-upgrade-gate.yml`

Created at:

`034263ea4d936b210b24e806668368054fc248a2`

Validation run:

`33458835844`

Job:

`99704473401` success

Current behavior proved:

- canonical is v0.7.1
- CodePath is still `bin/plugin-v071.cjs`
- canonical does not contain App Volume
- v0.8-only production steps remain dormant

After canonical becomes `0.8.0.0`, this workflow automatically requires promoted identity/files and the v0.7.1 -> production v0.8 upgrade regression.

## Guarded promotion tool

Approval template:

`products/stream-deck-ultimate-bundle/experiments/per-app-audio/hardware-approval-v08.template.json`

Promotion tool:

`products/stream-deck-ultimate-bundle/experiments/per-app-audio/promote-v08.ps1`

Default mode is plan-only.

It refuses promotion until the real host test and every Lab hardware gate are marked passed. It also refuses if production-relevant App Volume source drifted from the pinned approved runtime.

## Full `-Apply` mechanics are already tested

Promotion tool supports `-CanonicalDir` only so CI can target a disposable clone; omitting it still targets real canonical production.

Full promotion-mechanics workflow:

`.github/workflows/stream-deck-ultimate-v08-promotion-mechanics-ci.yml`

Run:

`33459008412`

Job:

`99704995273` success

This run performed the actual guarded `-Apply` path against a disposable clone of canonical v0.7.1 and proved:

- synthetic approval passed the same guard
- helper built
- candidate staged
- backup/overlay/verify path completed
- disposable clone became v0.8
- UUID stayed production UUID
- CodePath became `bin/plugin-v08.cjs`
- action count became 16
- exactly one App Volume action existed
- helper DLL existed
- no C# source was introduced
- actual real canonical v0.7.1 stayed byte-clean
- runtime dependency installed into the promoted clone
- seeded v0.7.1 -> v0.8 upgrade regression passed against the literal `-Apply` result
- v0.6 logic regression passed against the `-Apply` result
- v0.7 Smart Context logic regression passed
- v0.7.1 diagnostics logic regression passed
- frozen core runtime smoke passed
- Smart Context runtime smoke passed
- diagnostics runtime smoke passed

This removes promotion-copy mechanics as an untested step.

## Real Windows host test

Preferred user-facing source-free bundle contains:

- `PackRatAppAudio.dll`
- `app-audio.ps1`
- `real-host-smoke.ps1`
- `run-host-test.cmd`
- `run-host-test-and-save.cmd`
- `HOST_TEST.md`
- `BUNDLE_INFO.json`

Preferred command with Spotify actively playing audio:

`run-host-test-and-save.cmd -Process Spotify -Exercise`

Required result:

`write-and-restore-pass`

It automatically writes:

`host-test-result.json`

Latest host-bundle proof:

- run `33458488696`
- job `99703444108` success
- artifact `9782308572`
- artifact digest `225e2a18e3f1f8081b5e6c3374d0c9af66151f16329d7a6ba92be91b27845606`

CI actually runs the self-recording launcher and validates the saved JSON/helper hash.

## Co-installable App Volume Lab

Use the separate-UUID Lab plugin for physical Stream Deck testing. It must not replace accepted Ultimate.

Latest pinned Lab proof:

- run `33458372407`
- job `99703106645` success
- artifact `9782281223`
- artifact digest `c52c7deee9bc51389caf6bbf9f9a2e0c1c147d2ba761cf7acfbf995c1471b7d2`

Lab artifact passed runtime WebSocket smoke, helper integrity, official Elgato validation, and official Elgato packing.

## Only remaining blockers

### Physical gate 1

Run the real Windows host exercise and obtain `write-and-restore-pass`.

Return `host-test-result.json`.

### Physical gate 2

On the separate Lab plugin verify:

- Current App follows foreground app
- Specific App targets chosen process
- keypad mute/unmute
- dial volume
- dial push mute/unmute
- WAITING safety
- AUDIO OFF safety
- focus changes do not retarget an in-flight dial burst
- PI app list
- manual process entry
- Lab uninstall leaves accepted Ultimate v0.7.1 unaffected

## Mechanical sequence after hardware approval

1. fill a copy of `hardware-approval-v08.template.json` from physical evidence
2. run `promote-v08.ps1` without `-Apply`
3. verify the plan
4. run `promote-v08.ps1 -Apply`
5. run normal production Ultimate CI
6. require `Stream Deck Ultimate v0.8 Production Upgrade Gate` success on canonical v0.8
7. require official Elgato validation and packing
8. verify final production artifact identity/hash
9. ship

At this checkpoint there is no known software task that should be done before physical proof without merely duplicating an already-green gate or changing the approved runtime unnecessarily.
