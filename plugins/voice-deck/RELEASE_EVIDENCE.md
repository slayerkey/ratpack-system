# Voice Deck Release Evidence

Final automated candidate commit: `6aaccc6506c1ea6dbfaee98ea560ae6d47d568bb`

Final tested tree: `a4482bdab140ada4074d1c61b6ce0159d73452c8`

Landed main commit with the same tree: `4c97e765afa9b1ead8746a596e33054be0f1634d`

Windows GitHub Actions release run: `33329108034`

Result: PASS

Release artifact digest: `sha256:285b95f941b94c7f15b5af72c95c5b74055f4e937176b969077526873e546bec`

Packaged plugin SHA256: `54ac266a172e5622b29f1b30fe802f6b8ce3eb80734126822cbd5adb5664919f`

Passed gates:

* locked dependency install
* dependency audit at high severity threshold
* deterministic plugin asset and profile build
* automated voice-state, rendering, protocol, package, security, and stress tests
* immutable bundle/security checks
* official Elgato Stream Deck CLI validation
* official Elgato `.streamDeckPlugin` packaging
* deterministic Rat Art generation
* output verification and artifact upload

Post-CI artifact inspection confirmed one packaged plugin, four deterministic profile archives, six Marketplace PNGs at required dimensions, and no credential-secret patterns in the package.

This evidence does not claim real Discord authorization, physical Stream Deck behavior, or commercial Discord RPC approval. Those remain explicit release gates.
