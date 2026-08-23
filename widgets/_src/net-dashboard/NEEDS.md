# Network Dashboard shared needs

The product is intentionally self contained inside its approved write boundary.

## Current release blockers

None identified in shared runtime, Rat Art, or Rat Ship.

The canonical XENEON workflows now resolve the changed product slug automatically, Rat Art accepts product local fixtures and copy, Rat Ship validates submission metadata generically, and packaged network smoke tests are supported from `widgets/_src/<slug>/network-smoke.mjs`.

## External endpoints

The widget ships with these default HTTPS endpoints:

* `speed.cloudflare.com`
* `api.open-meteo.com`
* `api.coingecko.com`

It also supports user supplied CORS compatible HTTPS probe URLs through the iCUE textfield setting.

The historical August 2026 handoff described a static `registry.json` `network_hosts` allowlist. That policy is not part of the current canonical XENEON release workflow in `ratpack-system`. If a static external host policy is reintroduced later, the three default hosts above and a deliberate rule for runtime user supplied HTTPS URLs must be included.

## Shared runtime migration

No shared runtime change is required to ship this product. The minimum timeout, persistence, property read, scheduling, and throughput helpers remain product local until a generic XENEON runtime is migrated and proven equivalent.
