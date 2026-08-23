# Shared owner pass status

Resolved on this branch:

1. XENEON PR workflows resolve the changed widget slug instead of defaulting to Now Playing.
2. Rat Art capture accepts a product-owned deterministic fixture while preserving the Now Playing fixture path.
3. Rat Art composition reads product-owned `art.json` metadata for non-Now-Playing widgets.
4. Rat Ship invariants read the product submission metadata instead of hardcoding name and price.

Still intentionally outside this pass:

1. Historical `_shared/` runtime migration. The product-local implementation remains until a repository-wide migration is justified.
2. `registry.json` host reconciliation for `127.0.0.1`, because the original product boundary explicitly forbids registry edits.
