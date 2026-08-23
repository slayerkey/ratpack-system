# Helldivers 2 Galactic War shared needs

Product writes are intentionally restricted to `widgets/_src/helldivers/` and `widgets/helldivers/`.

## Network host registration

The widget calls only:

`api.helldivers2.dev`

If any current structural or registry gate still requires a central network host allowlist, add this host outside the product branch before promotion.

## Shared XENEON Rat Art fixture routing

Current `tools/art/capture_xeneon.mjs` is slug shaped but its fixture is Now Playing specific. It injects the Media provider, Now Playing settings, Now Playing storage keys, and asserts a fixed song title.

Helldivers needs the shared capture runner to support product specific deterministic fixtures, or to load a fixture adapter from `widgets/_src/<slug>/`. The product includes `verify.mjs` with a deterministic Helldivers API fixture that can be reused for that generic adapter.

Do not copy the Now Playing fixture into shared code for this product.

## Shared Rat Art composition

Current `tools/art/rat_art.py` contains Now Playing specific gallery copy and required palette captures. Helldivers needs the compositor to accept product specific art metadata and required shot sets while retaining the deterministic device plate and font gates.

Trademark requirement for this product remains absolute: no game art, Arrowhead or Sony logos, or faction insignia.

## Rat Ship workflow invariants

Current `.github/workflows/rat-ship-xeneon.yml` has Now Playing specific final assertions for product name and price. Those assertions need to read `widgets/_src/<slug>/submission.json` before Rat Ship can be generic for Helldivers.

No shared tooling was modified on this branch.
