# Voice Deck Release Evidence

Automated release candidate commit: `8d383d36bfaf7605a7db1f217f264cda40af2e6a`

Windows GitHub Actions release run: `33328912926`

Result: PASS

Release artifact digest: `sha256:5d820f9159a83a83ef7c8ca915e76a2070cb8f087970c09f436b9e62cf623310`

Packaged plugin SHA256: `904690d87fe2ab5d09d92ced1e34627390732abf3a987383094af5174d6b6c2e`

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
