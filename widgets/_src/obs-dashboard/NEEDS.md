# Stream Dashboard shared needs

Product slug: `obs-dashboard`

The shared owner pass resolved the release tooling blockers that were originally recorded here:

1. XENEON pull request workflows now resolve the changed widget slug instead of defaulting to Now Playing.
2. Rat Art capture now accepts a product owned deterministic fixture while preserving the existing Now Playing path.
3. Rat Art composition now reads product owned `art.json` metadata for non Now Playing widgets.
4. Rat Ship now validates against each product's `submission.json` instead of hardcoded Now Playing name and price values.

Two follow ups remain intentionally unresolved:

1. The current canonical repository still does not contain the historical `widgets/_shared/` runtime referenced by the August 16 handoff. Stream Dashboard therefore keeps the minimum product local equivalents for iCUE property reads, instance local caching, WebSocket request correlation and reconnection. This is not a release blocker. Migrate only if a repository wide shared runtime is restored and clean runner parity is proven.
2. The historical handoff requires `127.0.0.1` in the product `network_hosts` registry entry. The original product boundary explicitly forbids editing `registry.json`, so that reconciliation remains an owner registry task if the legacy registry gate is restored or still used downstream.
