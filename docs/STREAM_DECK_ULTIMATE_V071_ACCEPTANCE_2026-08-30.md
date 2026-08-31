# Stream Deck Ultimate Bundle — v0.7.1 Support Candidate Acceptance

Date: 2026-08-30 Arizona time / 2026-08-31 UTC

## Exact accepted candidate

Branch: `product/stream-deck-ultimate-bundle`

Tested commit:

`257dfe73ff37b5628a22bdece9718075f7d4f8b3`

Manifest version:

`0.7.1.0`

Manifest CodePath:

`bin/plugin-v071.cjs`

GitHub Actions run:

`33350973237`

Artifact:

`stream-deck-ultimate-bundle-v0.7.1-support-beta`

Artifact digest reported by GitHub Actions:

`sha256:ae479779f5411afd009aa73b202a6df8bda1120f1e9c812169ecafac862b1359`

This is a hardware/support candidate, not a public Marketplace release declaration.

## What v0.7.1 adds over the v0.7 Smart checkpoint

### PackRat family branding

The generic `P + green dot` plugin/category mark is replaced by a deterministic small-format PackRat mark:

- white rodent silhouette
- carried green package
- rounded brand container
- dedicated 28px, 56px, 256px, and 512px renders
- designed to remain recognizable at the actual Stream Deck sidebar category size

The rest of the proven key-face language remains unchanged.

### Privacy-safe Diagnostics Report

A new reusable `Diagnostics Report` action creates a local JSON support report and opens its location on Windows.

The report includes only support-relevant structure/state:

- Ultimate version, UUID, and CodePath
- Windows/Node/runtime information
- config/log/clipboard-history file metadata
- setup-complete state
- sanitized workspace app structure and layouts
- whether a workspace URL is configured, but never the URL
- audio endpoint names/default state and current volume/mic state when the endpoint probe is available
- audio preset values
- common-app installed/available flags
- log line count, issue-line count, and last timestamp

Privacy contract enforced by automated tests:

- clipboard contents: **never included**
- snippet contents: **never included**
- workspace URLs: **never included**
- raw log lines: **never included**
- full custom executable paths: **never included**
- common URL, email, Windows user-profile, home-directory, and network-path patterns in probe errors are redacted

The runtime smoke deliberately plants secret values in config, clipboard history, and logs and fails if any planted secret appears in the generated report.

### Diagnostics inspector UX

The Diagnostics action's Property Inspector explicitly explains:

- what is included
- what is excluded
- where the report is written
- that the user can inspect the JSON before sharing it

No cloud upload is performed by Ultimate.

## Green automated gates on the exact candidate

### Windows runtime job

All passed:

1. locked runtime dependency install
2. v0.6 proven product-logic regression
3. v0.7 Smart Context pure logic
4. v0.7.1 diagnostics privacy logic
5. proven v0.6 core through the current v0.7.1 manifest CodePath
6. Smart Context through the current multiplexed runtime
7. privacy-safe Diagnostics action through the current multiplexed runtime
8. PowerShell audio helper parser gate

### Validate-and-pack job

All passed:

1. deterministic v0.7.1 art/profile generation
2. v0.7 Context art polish pass
3. JavaScript syntax checks
4. Python syntax checks
5. v0.6 product-logic regression
6. v0.7 Smart Context logic
7. v0.7.1 diagnostics privacy logic
8. proven core through current manifest CodePath
9. Smart Context runtime smoke
10. Diagnostics runtime smoke with planted-secret leak assertions
11. all eight profile files and previews present
12. PackRat brand icon dimensions verified
13. PackRat mark verified to contain meaningful white silhouette and green accent coverage
14. official Elgato Stream Deck CLI validation
15. official Elgato `.streamDeckPlugin` packing
16. artifact upload

## Visual review performed after packaging

The packaged outputs were visually inspected at generated size.

Accepted:

- 256px Marketplace PackRat mark: clear rodent + green package read
- 56px category mark: clear at small size
- actual 28px category mark extracted from the packaged plugin: still recognizable
- Diagnostics `REPORT` key: one document/health-line symbol plus one short label, no decorative clutter

The earlier v0.7 visual fix remains in the pipeline: VS Code Command Palette and Terminal do not use identical generated key art after the polish pass.

## Rollback checkpoint

The previous known-good Smart Context package remains v0.7.0.0.

Its polished package gate passed at commit:

`47cdd96abcf8214ddb06838bc826af91773472a8`

v0.7.1 was intentionally implemented as another sidecar wrapper around the proven v0.6 runtime rather than rewriting the core actions.

If the Diagnostics layer causes a real-host problem, remove/revert the v0.7.1 support wrapper and return to the v0.7 candidate without unwinding Smart Context or the v0.6 core.

## Physical-host truth boundary

Automated CI is not allowed to upgrade these claims into physical proof.

Already proven historically on real Stream Deck hardware in earlier checkpoints includes core runtime execution such as window/capture behavior and the iterative profile/runtime corrections recorded in the product history.

Still requiring broad real-machine acceptance on the current candidate:

- current Windows playback endpoint enumeration on the user's actual drivers
- output-device switching across the user's actual endpoints
- current capture/input endpoint enumeration
- microphone mute/live state against the user's actual microphone stack
- Stream Deck+ live audio dials on physical hardware
- Work / Focus / Meeting / Gaming routines using the user's actual audio devices and apps
- Smart Context foreground transitions across the user's actual applications
- active-state indicators on physical keys
- setup/onboarding with the user's installed-app set
- Diagnostics report creation/open-location behavior on the user's normal desktop profile

The required test should be a broad matrix pass, not a one-button-at-a-time debugging loop.

## Per-application audio remains experimental

The separate Core Audio session experiment is intentionally **not included** in v0.7.1.

Current evidence for that experiment:

- PowerShell wrapper syntax passes
- native Core Audio session COM interop compiles on Windows Server 2025 / Windows PowerShell in GitHub Actions
- hosted CI exposes no usable playback endpoint, so real application-session enumeration/control cannot be claimed there

Promotion rule:

Do not merge per-app audio into the accepted product merely because the COM layer compiles. First prove session enumeration and read/write control on a normal Windows audio host, then design the Stream Deck behavior around `Current App Volume` and stable named app channels.

## Release rule

Do not describe v0.7.1 as Marketplace-ready until the broad real-host acceptance matrix has been completed and the current audio/Smart/onboarding behavior has been observed on physical hardware.

Do not weaken the regression gates to make a future feature pass.
