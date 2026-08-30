# Voice Deck QA

## Automated release candidate

Status: PASS

Candidate commit: `8d383d36bfaf7605a7db1f217f264cda40af2e6a`

GitHub Actions run: `33328912926`

Release artifact digest: `sha256:5d820f9159a83a83ef7c8ca915e76a2070cb8f087970c09f436b9e62cf623310`

Packaged `.streamDeckPlugin` SHA256: `904690d87fe2ab5d09d92ced1e34627390732abf3a987383094af5174d6b6c2e`

The clean Windows release job passed locked dependency installation, dependency audit, deterministic build and profile generation, the automated test suite, immutable distribution/security checks, official Elgato validation, official Elgato packaging, deterministic Marketplace media rendering, output verification, and release-evidence upload.

The downloaded CI artifact was independently inspected after the workflow. It contained one packaged plugin, the expected Property Inspector and generated assets, four bundled profile archives, and six Marketplace images. The package contained no matches for client secret material, Discord bot authorization, user-token scraping, or localStorage credential persistence.

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

The automated release candidate is not a substitute for `REAL_WINDOWS_SMOKE.md`. Actual Discord Desktop authorization, live Discord voice behavior, Stream Deck software/hardware interaction, and packaged-plugin parity still need to be recorded against a final candidate before public submission.

Discord commercial RPC approval or explicit written permission to use the StreamKit development identity remains a separate external release boundary. `BLOCKED_EXTERNAL_APPROVAL` must stay fail closed until that is resolved.
