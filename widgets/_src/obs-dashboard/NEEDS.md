# Stream Dashboard shared needs

Product slug: `obs-dashboard`

The product is implemented without writing outside the allowed product folders. These shared follow-ups are intentionally not applied here.

1. The current canonical repository does not yet contain the historical `widgets/_shared/` runtime referenced by the August 16 handoff. Stream Dashboard therefore carries the minimum product-local equivalents for iCUE property reads, instance-local caching, rate-safe rendering, WebSocket request correlation and reconnection. Reconcile these only after a generic shared runtime is migrated and clean-runner parity is proven.
2. The current `tools/art/capture_xeneon.mjs` and `tools/art/rat_art.py` are still tailored to Now Playing, including Media-provider fixture assumptions and Now Playing-specific DOM/art composition. The shared XENEON capture path needs a product fixture contract before deterministic Stream Dashboard marketplace art can be generated from real widget captures.
3. `.github/workflows/rat-ship-xeneon.yml` currently contains Now Playing-specific name and price invariants. Rat Ship must read these invariants from `widgets/_src/<slug>/submission.json` before Stream Dashboard can use the shared ship workflow without modifying shared files from this product branch.
4. The XENEON pull-request workflows currently default to `now-playing` instead of discovering the changed widget slug. Stream Dashboard therefore cannot receive its own official CLI and StreamSpell PR gate automatically without a shared workflow change.
5. The historical handoff requires `127.0.0.1` in the product `network_hosts` registry entry. The current product boundary forbids registry edits, so the owner should add that host if the legacy registry gate is restored or still used downstream.
