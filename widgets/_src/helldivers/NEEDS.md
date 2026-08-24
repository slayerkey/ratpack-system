# Helldivers 2 Panel shared needs

No outstanding shared release blockers remain for this product.

The widget calls only `api.helldivers2.dev`, with the exact approved `X-Super-Client` and `X-Super-Contact` headers. The current canonical repository does not contain the older central `registry.json` host allowlist described by the August handoff, and the current XENEON release workflows do not require a separate host registration.

The previously recorded shared blockers were resolved with explicit owner approval on this product branch:

* XENEON PR workflows now resolve the actual product slug instead of silently testing Now Playing.
* Rat Art capture loads a product owned deterministic fixture from `widgets/_src/<slug>/rat-art.mjs`.
* Rat Art composition loads product owned deterministic copy and shot metadata from `widgets/_src/<slug>/rat-art.json`.
* Rat Ship invariants read the current product's `submission.json` instead of hardcoding Now Playing name and price.
* StreamSpell distinguishes its own intentional outbound-network CSP blocks from genuine packaged-widget console errors while preserving strict failure for every other console error.

Trademark requirement remains absolute for Helldivers: text names only, no game art, no Arrowhead or Sony logos, and no faction insignia.
