# Voice Deck QA

## Automated release candidate

Status: PASS

Final tested candidate commit: `6aaccc6506c1ea6dbfaee98ea560ae6d47d568bb`

Final tested tree: `a4482bdab140ada4074d1c61b6ce0159d73452c8`

Landed main commit with the same tested tree: `4c97e765afa9b1ead8746a596e33054be0f1634d`

GitHub Actions release run: `33329108034`

Release artifact digest: `sha256:285b95f941b94c7f15b5af72c95c5b74055f4e937176b969077526873e546bec`

Packaged `.streamDeckPlugin` SHA256: `54ac266a172e5622b29f1b30fe802f6b8ce3eb80734126822cbd5adb5664919f`

The final clean Windows release job passed locked dependency installation, dependency audit, deterministic build and profile generation, the automated test suite, immutable distribution/security checks, official Elgato validation, official Elgato packaging, deterministic Marketplace media rendering, output verification, and release-evidence upload.

The final CI artifact was independently downloaded and inspected after the workflow. It contained one packaged plugin, the expected Property Inspector and generated assets, four bundled profile archives, and six Marketplace images. The package contained no matches for client secret material, Discord bot authorization, user-token scraping, or localStorage credential persistence.

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

## Profile artifact inspection

* Neo: 8 keypad actions, including 4 dynamic member slots
* MK.2 / 15 key: 15 keypad actions, including 10 dynamic member slots
* Stream Deck +: 8 keypad actions plus the Voice Navigator encoder
* XL: 32 keypad actions, including 24 dynamic member slots

## Remaining real host boundary

The automated release candidate is not a substitute for `REAL_WINDOWS_SMOKE.md`. Actual Discord Desktop authorization, live Discord voice behavior, Stream Deck software/hardware interaction, and packaged-plugin parity still need to be recorded against the final candidate before public submission.

Discord commercial RPC approval or explicit written permission to use the StreamKit development identity remains a separate external release boundary. `BLOCKED_EXTERNAL_APPROVAL` must stay fail closed until that is resolved.
