# Voice Deck QA

## Release status

Status: PASS

Workflow state: `READY_TO_SHIP`

Customer-facing product name: `PackRat Voice Deck for Discord`

## Automated release candidate

Final tested candidate commit: `6aaccc6506c1ea6dbfaee98ea560ae6d47d568bb`

Final tested tree: `a4482bdab140ada4074d1c61b6ce0159d73452c8`

Landed main commit with the same tested tree: `4c97e765afa9b1ead8746a596e33054be0f1634d`

GitHub Actions release run: `33329108034`

Release artifact digest: `sha256:285b95f941b94c7f15b5af72c95c5b74055f4e937176b969077526873e546bec`

Original packaged `.streamDeckPlugin` SHA256: `54ac266a172e5622b29f1b30fe802f6b8ce3eb80734126822cbd5adb5664919f`

Final physically approved centered-avatar package SHA256: `ec5d09c3db484a0c83b57f3f2d3b205106eca06a0e22f8c4c1cc672fe248fab5`

The clean Windows release job passed locked dependency installation, dependency audit, deterministic build and profile generation, the automated test suite, immutable distribution/security checks, official Elgato validation, official Elgato packaging, deterministic Marketplace media rendering, output verification, and release-evidence upload.

The final CI artifact was independently inspected. It contained one packaged plugin, the expected Property Inspector and generated assets, four bundled profile archives, and six Marketplace images. The package contained no matches for client secret material, Discord bot authorization, user-token scraping, or localStorage credential persistence.

## Automated suite coverage

The repository test suite covers:

* Discord frame encoding and chunked decoding
* oversized frame fail-closed behavior
* connect, authenticate, disconnect, reconnect, and Discord restart behavior
* selected voice channel refresh and voice channel switching
* roster joins, updates, leaves, and duplicate resistance
* speaking start, speaking stop, multiple speaking state normalization, and speaker hold behavior
* mute, unmute, deafen, and undeafen round trips
* stable and speaking-first roster ordering
* Unicode, emoji, long names, missing avatars, and initials fallback
* 50-member normalization
* 1,500 rapid speaking/render updates across a 50-member roster
* all key render states including disconnected and authorization-needed states
* local-only Property Inspector dependency policy
* no user-token scraping, client secret, or credential material in bundled profiles
* manifest SDKVersion 3, Node 24, twelve focused actions, and four bundled profiles
* exact centered avatar/ring geometry from the real-device visual fix

## Profile artifact inspection

* Neo: 8 keypad actions, including 4 dynamic member slots
* MK.2 / 15 key: 15 keypad actions, including 10 dynamic member slots
* Stream Deck +: 8 keypad actions plus the Voice Navigator encoder
* XL: 32 keypad actions, including 24 dynamic member slots

## Real Windows host evidence

Physical smoke: PASS

Host environment recorded during the final test sequence:

* Windows 11 Home 10.0.26200 build 26200
* Discord Desktop 1.0.9255
* Stream Deck 7.5.0.22885
* Discord IPC pipe detected
* Discord authorization PASS
* live voice channel PASS
* real member roster PASS
* live speaker state PASS
* channel switching PASS
* packaged visual parity PASS after centered-avatar fix

`rat audit voice-deck --probe` returned PASS for the live Discord transport. The standard host audit returned WARN only because it counted historical plugin-log error lines from earlier failed prerequisites; all current host prerequisites passed.

## External release approval

Discord commercial release approval is treated as CLEARED by explicit operator confirmation on 2026-08-30. The operator instructed release tooling to proceed without an independent verification pass of the external approval message and approved the customer-facing name `PackRat Voice Deck for Discord`.

No runtime authentication change is being introduced after the physical smoke. The current tested Discord transport is the release path for this build.

## Ship command

```text
rat ship voice-deck
```
