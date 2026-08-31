# Stream Deck Ultimate v0.8 prepromotion checkpoint

Date: 2026-08-30 / 2026-08-31 UTC

## Status

The App Volume implementation and the integrated v0.8 candidate are complete through automated prepromotion validation.

Do **not** promote or install the integrated v0.8 candidate on the hardware test machine yet. It reuses the production plugin UUID and would replace accepted v0.7.1. Physical App Volume proof must happen first through the co-installable Lab plugin.

Accepted v0.7.1 remains frozen in:

`products/stream-deck-ultimate-bundle/prototype/com.packrat.stream-deck-ultimate-bundle.sdPlugin`

A compare from accepted commit `257dfe73ff37b5628a22bdece9718075f7d4f8b3` through the green v0.8 prepromotion head contains no changes inside that accepted `.sdPlugin` directory.

## Green integrated candidate

Source head:

`15cc99c96bf243dfccb0b18774e859882c97684b`

Workflow:

`Stream Deck Ultimate v0.8 Prepromotion CI`

Run:

`33357424824`

Windows behavior job:

`99382133122` — success

Ubuntu release/package job:

`99382254031` — success

### Windows behavior proof

The Windows job passed:

- v0.8 integration JavaScript syntax
- staging PowerShell syntax
- precompiled `PackRatAppAudio.Core` + `PackRatAppAudio.Foreground` helper build
- candidate staging from frozen v0.7.1
- byte-clean accepted v0.7.1 source check
- locked Node runtime install
- frozen v0.6 product logic regression
- frozen v0.7 Smart Context logic regression
- frozen v0.7.1 diagnostics privacy regression
- frozen core through `bin/plugin-v08.cjs`
- Smart Context through `bin/plugin-v08.cjs`
- Diagnostics through `bin/plugin-v08.cjs`
- combined legacy core + lazy App Volume in one plugin process
- Current App App Volume dial feedback and writes through mock worker
- App Volume mute press
- App Volume Property Inspector app list
- named-app keypad rendering
- legacy actions still rendering after App Volume worker startup
- helper/hash candidate contract
- Windows staged candidate artifact upload

App Volume is lazy loaded. Existing actions do not start the Core Audio worker. The worker is created only after an App Volume event is received.

### Release/package proof

The exact Windows-staged candidate was transferred to Ubuntu. Ubuntu then passed:

- proven v0.7.1 release art generation inside staging only
- context art polish inside staging only
- 8 profile generation
- staged manifest identity verification
- App Volume action identity verification
- helper SHA verification
- no packaged C# source
- locked Node runtime install
- staged JavaScript syntax
- current Elgato CLI install
- official `streamdeck validate`
- official `streamdeck pack`
- final artifact upload

## Final prepromotion artifact

Artifact ID:

`9745586711`

Artifact name:

`stream-deck-ultimate-v0.8-prepromotion-candidate`

GitHub artifact ZIP SHA256:

`0fa24d4e8c7b87de1b80561ab9f137d1bf7b245e08cc5e661bf22375ed3e7b9b`

Packed plugin SHA256:

`a3790e672ce18bc9887d1b8b2f0175c663c548a4d4bad19c287f1cf2003d9497`

Packed plugin size:

`677710` bytes

Local archive copy during the validation session:

`/mnt/data/Stream-Deck-Ultimate-v0.8-Prepromotion-Candidate-CI.zip`

Local packed candidate copy during the validation session:

`/mnt/data/Stream-Deck-Ultimate-v0.8-PREPROMOTION-DO-NOT-INSTALL.streamDeckPlugin`

## Packed manifest facts

Plugin UUID:

`com.packrat.stream-deck-ultimate-bundle`

Version:

`0.8.0.0`

CodePath:

`bin/plugin-v08.cjs`

Actions:

`16`

Profiles:

`8`

New action UUID:

`com.packrat.stream-deck-ultimate-bundle.app-audio`

New action controllers:

- Keypad
- Encoder

App Volume Property Inspector:

`ui/property-inspector-app-volume.html`

Packaged helper SHA256:

`06b98b09c9e7de2c16c143e2032e7767cf1caa45a654487306ea6354c4b736c1`

The DLL hash exactly matches `V08_CANDIDATE_INFO.json`.

Packaged C# source count:

`0`

## Release architecture

The v0.8 prepromotion gate deliberately separates responsibilities:

1. Windows owns real runtime composition and frozen behavior regressions.
2. Windows uploads the exact staged plugin candidate, excluding transient `node_modules`.
3. Ubuntu downloads that candidate.
4. Ubuntu runs the same proven v0.7.1 art/profile generation used by accepted release CI.
5. Ubuntu verifies the staged identity and helper hash.
6. Ubuntu installs locked Node dependencies.
7. Ubuntu runs official Elgato validation and packing.

This avoids forcing CairoSVG native Cairo dependencies onto the Windows runtime runner while still guaranteeing that official packaging is performed on the same staged candidate that passed Windows integration tests.

## Remaining promotion gates

Automated prepromotion work is finished. The remaining blockers are intentionally physical/reversible:

### 1. Real Windows host write-and-restore proof

Use the source-free host test bundle with an actively playing app, for example:

`run-host-test.cmd -Process Spotify -Exercise`

Required result:

`write-and-restore-pass`

### 2. Physical Stream Deck proof through Lab plugin

Use the separate-UUID App Volume Lab plugin, not this integrated candidate.

Verify:

- Current App follows the foreground app
- Specific App targets the selected process
- keypad mute/unmute behaves correctly
- Stream Deck+ dial adjusts volume using 1 / 2 / 5 percent sensitivity
- dial push mute/unmute behaves correctly
- WAITING is safe when a configured app has no audio session
- AUDIO OFF is safe when Windows exposes no endpoint
- fast focus changes while rotating do not retarget an in-flight dial burst
- Property Inspector lists active audio apps and accepts manual process names
- removing the Lab plugin does not affect accepted Ultimate v0.7.1

### 3. Production promotion after physical proof

Only after gates 1 and 2 pass:

- promote the already-proven v0.8 integration files into the canonical product source
- keep the same production UUID
- set production version to v0.8
- run full production CI / official validate / official pack
- run an upgrade test from accepted v0.7.1 to v0.8
- verify existing profiles/settings survive the upgrade
- ship only after those final upgrade/regression gates are green

## Rule

Do not use the integrated prepromotion candidate as a substitute for the Lab hardware test. Its purpose is to eliminate merge/integration uncertainty before hardware approval, not to bypass the physical proof gate.
