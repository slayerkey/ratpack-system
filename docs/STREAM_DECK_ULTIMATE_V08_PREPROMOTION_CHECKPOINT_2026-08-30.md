# Stream Deck Ultimate v0.8 prepromotion checkpoint

Updated: 2026-09-01 UTC

## Current status

The software side of Stream Deck Ultimate v0.8 App Volume is complete through automated prepromotion, compatibility, promotion-safety, official validation, and official packing.

**Do not install or promote the integrated v0.8 production-UUID candidate before physical approval.** It uses `com.packrat.stream-deck-ultimate-bundle` and would replace accepted v0.7.1 on the hardware test machine.

Canonical accepted production remains frozen at:

`products/stream-deck-ultimate-bundle/prototype/com.packrat.stream-deck-ultimate-bundle.sdPlugin`

Canonical identity remains:

- UUID: `com.packrat.stream-deck-ultimate-bundle`
- Version: `0.7.1.0`
- CodePath: `bin/plugin-v071.cjs`
- Existing actions: 15
- Bundled profiles: 8

Accepted reference commit:

`257dfe73ff37b5628a22bdece9718075f7d4f8b3`

No App Volume production work has been copied into the canonical `.sdPlugin` directory.

## Pinned v0.8 runtime candidate

The hardware approval record is intentionally pinned to the first fully integrated green production-runtime candidate:

- source commit: `15cc99c96bf243dfccb0b18774e859882c97684b`
- packed plugin SHA256: `a3790e672ce18bc9887d1b8b2f0175c663c548a4d4bad19c287f1cf2003d9497`
- production UUID: `com.packrat.stream-deck-ultimate-bundle`
- version: `0.8.0.0`
- CodePath: `bin/plugin-v08.cjs`
- actions: 16
- profiles: 8
- new action: `com.packrat.stream-deck-ultimate-bundle.app-audio`
- controllers: Keypad + Encoder
- App Volume PI: `ui/property-inspector-app-volume.html`
- C# source shipped: 0
- App Volume worker: lazy loaded

Original integrated proof:

- workflow run `33357424824`
- Windows job `99382133122` success
- Ubuntu validate/pack job `99382254031` success
- artifact `9745586711`

The integrated installer is a prepromotion reference only. Physical testing must use the co-installable Lab plugin instead.

## App Volume implementation

App Volume lives under:

`products/stream-deck-ultimate-bundle/experiments/per-app-audio/`

The production-relevant implementation includes:

- precompiled Windows Core Audio helper
- foreground process resolver
- exact app-session model
- Current App mode
- Specific App mode
- keypad live volume/mute rendering
- Stream Deck+ volume dial
- dial push mute/unmute
- configurable 1 / 2 / 5 percent sensitivity
- WAITING behavior when a configured app has no active audio session
- AUDIO OFF behavior when Windows exposes no usable endpoint
- Property Inspector app discovery plus manual process entry
- cached/coalesced worker requests
- focus-lock behavior so an in-flight dial burst does not jump to a newly focused app

The integrated v0.8 runtime multiplexes legacy Ultimate actions and App Volume in one plugin process. App Volume is isolated behind a lazy worker, so existing actions do not start Core Audio machinery merely because Ultimate loaded.

## Green automated integration proof

Latest full fixture-aware v0.8 prepromotion run:

`33458732654`

Windows job:

`99704166947` — success

Ubuntu release/package job:

`99704307514` — success

Windows passed:

- v0.8 JavaScript syntax
- staging and guarded-promotion PowerShell syntax
- pending hardware approval rejection
- synthetic complete-approval read-only promotion plan
- helper build
- isolated staging from frozen v0.7.1
- canonical byte-clean check
- v0.6 product logic regression
- v0.7 Smart Context logic regression
- v0.7.1 diagnostics privacy regression
- legacy core through `plugin-v08.cjs`
- Smart Context through `plugin-v08.cjs`
- Diagnostics through `plugin-v08.cjs`
- combined legacy + lazy App Volume runtime
- seeded v0.7.1 to v0.8 upgrade regression
- helper/runtime contract verification

Ubuntu passed:

- proven v0.7.1 release art generation inside staging only
- all 8 profile generation
- release-stage identity verification
- helper integrity verification
- no C# source verification
- locked Node dependency install
- staged JavaScript syntax
- official Elgato `streamdeck validate`
- official Elgato `streamdeck pack`

## Upgrade compatibility is already proven

Upgrade regression:

`products/stream-deck-ultimate-bundle/experiments/per-app-audio/upgrade-regression-v08.js`

The test seeds realistic v0.7.1 state into temporary APPDATA and proves that staged v0.8 preserves:

- production plugin UUID
- every existing action UUID/manifest contract
- all bundled profile declarations
- setup state
- selected input/output devices
- workspace settings
- audio preset settings
- clipboard settings
- clipboard history

On Windows it also launches the multiplexed v0.8 runtime, displays both an old action and the new App Volume action in one process, and verifies merely starting/displaying v0.8 does not mutate the old state files.

A permanent accepted-manifest fixture now exists at:

`products/stream-deck-ultimate-bundle/experiments/per-app-audio/accepted-v071-manifest-contract.json`

Commit adding the fixture:

`c5c6ec040703114ba52e48de425ac9c932a1e4a3`

Fixture-aware upgrade regression commit:

`b2c0a6cd68fdefe7e83fa61623536720f074feab`

The regression uses canonical v0.7.1 while it is still canonical. After production becomes v0.8 it automatically falls back to the frozen fixture, so the backward-compatibility gate remains valid after promotion.

## Production promotion is guarded

Hardware approval template:

`products/stream-deck-ultimate-bundle/experiments/per-app-audio/hardware-approval-v08.template.json`

Guarded promotion tool:

`products/stream-deck-ultimate-bundle/experiments/per-app-audio/promote-v08.ps1`

Default behavior is plan-only. The tool refuses production promotion unless all of the following are true:

- approval refers to the expected production UUID
- accepted version is v0.7.1
- target is v0.8
- approval is pinned to the approved prepromotion source/hash
- real Windows host write-and-restore test passed
- every physical App Volume Lab gate passed
- `allowProductionPromotion` is true
- `approvedAt` is populated
- production-relevant App Volume source still matches the approved candidate
- there are no uncommitted production-relevant changes
- canonical source is still the frozen v0.7.1 baseline

CI explicitly proves:

1. the default pending template blocks promotion
2. a synthetic complete approval yields a read-only plan
3. plan mode does not modify canonical v0.7.1

`-Apply` is reserved for after physical approval. It stages the approved candidate, backs up canonical source, overlays v0.8, verifies identity/helper files, and restores the backup if application fails. It does not auto-commit or auto-ship.

## Post-promotion production gate is already installed

Companion workflow:

`.github/workflows/stream-deck-ultimate-v08-production-upgrade-gate.yml`

Created at:

`034263ea4d936b210b24e806668368054fc248a2`

The workflow is intentionally version-aware:

- while canonical is `0.7.1.0`, it verifies the accepted CodePath and absence of App Volume, then stays dormant
- if canonical is anything unexpected, it fails
- once canonical becomes `0.8.0.0`, it requires the v0.8 CodePath, exactly 16 actions, exactly one App Volume action, source-free packaged helper files, v0.8 runtime syntax, and the mandatory v0.7.1 -> production v0.8 upgrade regression using the frozen baseline fixture

This means the post-promotion upgrade test is already waiting before promotion occurs.

## Real Windows host test

Preferred source-free host test now has a self-recording entrypoint:

`run-host-test-and-save.cmd`

Preferred command with an actively playing app:

`run-host-test-and-save.cmd -Process Spotify -Exercise`

The exercise changes the target app volume by exactly 1 percentage point, verifies the change, restores the original volume, and verifies restoration. It does not change mute state.

Required success:

`write-and-restore-pass`

The wrapper automatically saves:

`host-test-result.json`

The user can return that file rather than manually diagnosing console output.

Latest source-free host-bundle CI:

- run `33458488696`
- job `99703444108` success
- artifact `9782308572`
- artifact digest `225e2a18e3f1f8081b5e6c3374d0c9af66151f16329d7a6ba92be91b27845606`

CI proves the self-recording launcher creates valid JSON, the JSON helper hash matches `BUNDLE_INFO.json`, and the bundle contains no C# source.

## Co-installable App Volume Lab

Physical Stream Deck proof must use the separate-UUID Lab plugin so accepted Ultimate v0.7.1 remains installed and untouched.

Latest verified Lab run:

- run `33458372407`
- job `99703106645` success
- artifact `9782281223`
- artifact digest `c52c7deee9bc51389caf6bbf9f9a2e0c1c147d2ba761cf7acfbf995c1471b7d2`

That run passed:

- App Volume product semantics
- JavaScript syntax
- PowerShell syntax
- Core Audio/foreground helper build
- separate-UUID plugin staging
- locked WebSocket runtime
- packaged runtime through real Stream Deck WebSocket protocol
- helper integrity
- official Elgato validation
- official Elgato packing

## Remaining physical acceptance gates

### Gate 1 — real Windows host

With an app actively producing audio:

`run-host-test-and-save.cmd -Process Spotify -Exercise`

Required result:

`write-and-restore-pass`

Return `host-test-result.json`.

### Gate 2 — physical Stream Deck Lab

Verify on the separate App Volume Lab plugin:

- Current App follows foreground app
- Specific App controls the selected process
- keypad mute/unmute works
- Stream Deck+ dial changes volume correctly
- dial push mute/unmute works
- WAITING is safe when the selected app has no audio session
- AUDIO OFF is safe when Windows exposes no endpoint
- fast focus changes do not retarget an in-flight dial burst
- Property Inspector lists active audio apps
- manual process name entry works
- removing the Lab plugin leaves accepted Ultimate v0.7.1 unaffected

## Promotion sequence after physical approval

Once both physical gates pass:

1. record the observed physical results in a copy of `hardware-approval-v08.template.json`
2. run `promote-v08.ps1` in plan mode
3. confirm the plan is still pinned to the approved implementation
4. run `promote-v08.ps1 -Apply`
5. run the normal production Ultimate CI
6. let the already-installed v0.8 Production Upgrade Gate run against canonical v0.8
7. require official Elgato validate/pack success
8. inspect the production artifact identity/hash
9. only then mark the build ship-ready

## Rule

No remaining software uncertainty is a reason to bypass the physical gate. The purpose of the prepromotion work is the opposite: after physical App Volume behavior is proven, production promotion should be mechanical, guarded, and regression-tested rather than another debugging phase.
