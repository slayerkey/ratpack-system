# Now Playing shared migration needs

The canonical `ratpack-system` repository does not yet contain the historical `widgets/_shared/` runtime, `widgets/_build/inline.py`, or the generic XENEON browser harness from the local factory.

For this acceptance build, `now-playing.js` intentionally includes the minimum product-local equivalents needed for property reads, persistence, Media provider correlation, animation throttling, and canvas sizing. This keeps the product inside its approved write boundary.

Future owner pass:

1. Migrate the proven shared runtime and generic widget harness into `ratpack-system`.
2. Compare the product-local helpers here against the canonical shared implementation.
3. Replace duplicates only after clean runner tests prove identical behavior.
4. Keep the exact XENEON manifest author string `PackRat 🐀` globally.

No shared runtime change is required for the product design itself.
