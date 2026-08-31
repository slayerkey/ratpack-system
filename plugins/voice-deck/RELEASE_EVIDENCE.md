# Voice Deck Release Evidence

Release status: `READY_TO_SHIP`

Customer-facing name: `PackRat Voice Deck for Discord`

Final automated candidate commit: `6aaccc6506c1ea6dbfaee98ea560ae6d47d568bb`

Final tested tree: `a4482bdab140ada4074d1c61b6ce0159d73452c8`

Landed main commit with the same tree: `4c97e765afa9b1ead8746a596e33054be0f1634d`

Windows GitHub Actions release run: `33329108034`

Result: PASS

Release artifact digest: `sha256:285b95f941b94c7f15b5af72c95c5b74055f4e937176b969077526873e546bec`

Original packaged plugin SHA256: `54ac266a172e5622b29f1b30fe802f6b8ce3eb80734126822cbd5adb5664919f`

Final physically approved centered-avatar package SHA256: `ec5d09c3db484a0c83b57f3f2d3b205106eca06a0e22f8c4c1cc672fe248fab5`

Passed automated gates:

* locked dependency install
* dependency audit at high severity threshold
* deterministic plugin asset and profile build
* automated voice-state, rendering, protocol, package, security, and stress tests
* immutable bundle/security checks
* official Elgato Stream Deck CLI validation
* official Elgato `.streamDeckPlugin` packaging
* deterministic Rat Art generation
* output verification and artifact upload
* exact avatar/ring centering regression coverage

Post-CI artifact inspection confirmed one packaged plugin, four deterministic profile archives, six Marketplace PNGs at required dimensions, and no credential-secret patterns in the package.

## Real Windows evidence

Physical smoke: PASS on 2026-08-30.

Recorded host environment:

* Windows 11 Home 10.0.26200 build 26200
* Discord Desktop 1.0.9255
* Stream Deck 7.5.0.22885
* Rat Dev/audit source commit `fa9b73f1d0ba47e59616fb4c40223c49d0ac8c31`

The Discord deep probe passed with authenticated RPC, required voice scopes, a real voice channel, live state events, and no transport error. Physical Stream Deck screenshots and operator testing confirmed real channel/member population, speaking state, channel switching, and packaged visual parity. The centered-avatar follow-up was physically approved.

## External release approval

On 2026-08-30 the operator explicitly confirmed that the required Discord commercial release approval had arrived and instructed release tooling to proceed without independently re-verifying the external approval message. The operator also approved proceeding with the name `PackRat Voice Deck for Discord`.

For this release state, the current physically tested Discord transport is treated as the approved production path and no post-smoke runtime authentication migration is being introduced.

Exact external support ticket metadata was not copied into this repository during the release pass.

## Marketplace release

Price: `$9.99`

Auto publish after Marketplace approval: enabled.

Ship command:

```text
rat ship voice-deck
```
