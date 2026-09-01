# PackRat Marketplace Style Lab V4

## Objective

The previous hero rounds proved that top-right and bottom-right title placements survive Marketplace browse size best, but the visual treatments are still too conservative. V4 deliberately expands the design space.

## Non-negotiables

1. The real product UI remains truthful and clearly visible.
2. Product name is extremely legible at approximately 15% scale.
3. PackRat branding is present but secondary.
4. Background/design treatment may be aggressive, but it cannot obscure the product.

## Six V4 directions

1. **Clean daylight desk**: realistic modern office/desk context, bright natural light, top-right title plaque.
2. **Creator desk at night**: RGB creator workspace, monitor glow, bottom-right title plaque.
3. **Premium studio office**: cinematic dark office environment, warm practical lighting, top-right title.
4. **First-party launch**: marketplace-inspired clean hardware launch language, large top-right typography, controlled color field.
5. **Bold marketplace promo**: high-contrast promotional card language, bottom-right typography, larger graphic shapes and stronger accent color.
6. **Editorial product campaign**: stylized magazine/poster composition, large top-right typography, strong photographic/graphic background treatment.

## Environmental background strategy

The renderer supports optional local office/desk backgrounds. These may be licensed photography, PackRat-owned photography, or generated background assets created outside the renderer and committed with clear provenance. The device itself and its screen remain deterministic real-product captures.

If an environmental source asset is unavailable, CI uses a deterministic synthetic workspace mockup so the experiment remains reproducible. This fallback is intentionally a composition test, not a claim that it is a real photograph.

## Marketplace inspiration rule

We can study and imitate high-level traits from strong Marketplace listings: hierarchy, product scale, title placement, color blocking, lighting, negative space, depth, and launch-campaign polish. We do not copy another creator's exact artwork, logos, product UI, illustrations, or a distinctive composition one-for-one.

## QA

Every candidate is rendered at 1920x960 and again at exactly 15% scale, 288x144. A candidate fails if the product name becomes difficult to read or the product stops being immediately identifiable.
