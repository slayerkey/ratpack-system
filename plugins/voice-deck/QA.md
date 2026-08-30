# Voice Deck QA

## Automated suite

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
* all key render states including disconnected and authorization-needed states
* local-only Property Inspector dependency policy
* no user-token scraping, client secret, or credential material in bundled profiles
* manifest SDKVersion 3, Node 24, twelve focused actions, and four bundled profiles

## Release gate

Windows CI must run:

1. `npm ci`
2. dependency audit
3. deterministic build and profile generation
4. automated tests
5. immutable release-bundle checks
6. official Elgato CLI validation
7. official Elgato `.streamDeckPlugin` packaging
8. deterministic Marketplace art

## Real host boundary

The final release candidate must additionally pass `REAL_WINDOWS_SMOKE.md` with actual Discord Desktop and actual Stream Deck software/hardware. This is not replaced by mocks or CI.
