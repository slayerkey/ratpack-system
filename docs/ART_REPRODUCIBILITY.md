# Art Reproducibility Contract

Marketplace art is successful only when output is both technically valid and visually faithful.

A zero exit code is not sufficient.

## Required preflight

Before composition:

1. Resolve the canonical marketing engine from versioned source.
2. Resolve the Packrat logo and required device plates from versioned assets.
3. Resolve the required brand font family and weight deterministically.
4. Verify every product specific source image required by the configuration.
5. For iCUE widget products, verify the real widget screenshots at the expected native sizes.
6. Reject absolute local paths that are not explicitly classified as host only dependencies.

If any required input is missing, stop before rendering.

## Fonts

Marketplace output must never silently fall back to a default Pillow bitmap font.

The canonical resolver should prefer an approved repo managed font location or a documented CI bootstrap location, verify the expected font, and fail otherwise.

Font binaries are not included in the migration bootstrap.

## Widget captures

XENEON art uses real deterministic captures from the widget harness.

Expected flow:

`widget build` -> `browser harness` -> `shots` -> `art preflight` -> `composition` -> `visual QA`

The art generator must not treat a missing shot as an optional value for a listing image that requires it.

## Candidate safety

Candidate art should be rendered into an isolated review job.

Live marketing folders and submitted ship kits are immutable during the candidate stage.

Promotion into live product art is a separate explicit operation after deterministic QA and visual review.

## QA

At minimum verify dimensions, file type, expected image count, text bounds, source presence, font identity, device plate presence, widget capture presence where applicable, and nontrivial content occupancy.
