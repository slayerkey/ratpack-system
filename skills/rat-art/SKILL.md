---
name: rat-art
description: Research, stage, render, and visually review PackRat marketplace artwork using deterministic repository tooling only. Never use ImageGen or any image-generation provider for Rat Art.
---

# Rat Art

Rat Art is a repository pipeline, not chat image generation.

## Non-negotiable execution rule

When the user invokes `/rat-art`, asks to use Rat Art, or asks to regenerate marketplace art through the Rat Art pipeline, **do not call ChatGPT image generation, ImageGen, DALL-E, an image API, or any other generative image provider**.

Run the canonical deterministic repository tooling instead. For XENEON widgets, use the current product build, `tools/art/capture_xeneon.mjs`, and the approved XENEON hero tooling described in `standards/xeneon-marketplace-hero-v1.md`.

If the deterministic pipeline is missing a required asset or capture, fail and fix or migrate that dependency. Never substitute generated artwork.

Read the product, validation evidence, product metadata, `standards/marketplace-listing-v2.md`, any product-family-specific standard, brand standards, art reproducibility contract, and applicable platform reference.

## Marketplace Listing V2

Marketplace Listing V2 is the canonical direction for new and migrated marketplace presentation.

The central rule is: **the product is the hero**.

A listing should answer the buyer's next natural question rather than repeat the same product screenshot under different headlines.

Default buyer journey:

1. Hero: what is this?
2. Product in action / demo when motion matters: what does it actually do?
3. Core value: why would I care?
4. Differentiator: what makes this more useful than the obvious/basic version?
5. Ease: is setup or regular use annoying?
6. Compatibility / trust: do I understand what I am getting and who made it?

This sequence is a decision framework, not a fixed asset count.

### V2 rollout safety

Schema-v1 product art remains supported and must keep rendering with its approved legacy composition until that product is deliberately migrated.

Use `rat-art.json` `schema_version: 2` only after the real source/captures needed for the candidate exist.

Do not use a shared renderer update as an excuse to silently regenerate every live marketplace product.

A legacy product with missing canonical screenshots/source is `SOURCE_REQUIRED`; do not fabricate a replacement from memory or old marketing copy.

## Safety model

Treat live product `marketing/` folders and submitted ship kits as immutable while creating a candidate.

Create an isolated review job or CI artifact for candidate sources, rendered output, provenance, deterministic QA, and visual review.

Do not promote candidate files into live marketing during this skill. Promotion is a separate approved operation.

## Product accuracy

Marketing polish may change the frame around a product. It may not change what the customer receives.

For hardware compositions use:

REAL PRODUCT CAPTURE

→ APPROVED DEVICE PLATE

→ APPROVED BACKGROUND / LIGHTING

→ DETERMINISTIC COPY / BRANDING

Never alter layout, controls, metrics, modes, values, availability, or behavior in a way that misrepresents the product.

If a claim needs a state that is not available in canonical source/captures, block or remove the claim rather than inventing proof.

## Nonwidget products

Use first-party contextual screenshots where the current product style calls for context. Preserve source provenance and reject low-resolution or unsuitable source images.

Keep PackRat text, device plates, icons, key faces, badges, and layouts deterministic.

Do not use generated images for product keys, text, device representations, marketplace screenshots, or contextual plates.

For Stream Deck plugins and profiles, the key cluster/device must be large enough to read as the product rather than decoration.

For icon packs, the icons themselves are the product. Show meaningful variety at readable key-like scale; do not bury them in a tiny device or a wall of hundreds of indistinguishable thumbnails.

## XENEON and iCUE widget products

`standards/xeneon-marketplace-hero-v1.md` is the current XENEON-specific hero standard and overrides older generic V2 XENEON hero defaults when they conflict.

Do not substitute a contextual background for the real widget. The environment may frame the product, but the UI shown on the XENEON device must come from a real deterministic capture.

Required product-proof path:

1. Build the current widget source.
2. Run deterministic browser captures at the required native sizes.
3. Verify the Rat Art fixture reaches the intended state without runtime errors or overflow.
4. Use the real `XL_H` capture for the marketplace hero.
5. Composite that capture into the approved calibrated XENEON Edge device plate.
6. Render the approved environment/title/brand treatment deterministically.
7. Generate a full contact sheet and exact 15% marketplace review sheet.

The capture gate must test glyph safety for clipped descenders and other text-bound failures before marketplace art is promoted.

### Approved XENEON hero composition

For the current approved XENEON family:

1. Product name is a primary hero element and is normally repeated prominently in the image.
2. Use one or two large semantic title lines rather than shrinking a long title into a tiny header.
3. Keep `Lite` / `Pro` in the visible product name when they are part of the actual listing name.
4. Keep `for XENEON Edge` subordinate to the product name.
5. Use the approved `warm-studio-v1` environment unless a new family scene has separately passed review.
6. Make the calibrated front-facing XENEON device a large foreground subject.
7. Show only the real widget capture inside that device.
8. Keep the PackRat rat/package mark small and secondary; current approved placement is an upper-right signature.
9. Do not add a second slogan that competes with the product name.
10. Do not duplicate the PackRat mark in the hero footer.

The older rule that discouraged poster-scale product names does **not** apply to the approved XENEON family. Browsing-scale testing showed that the larger title materially improves recognition.

### XENEON background and contextual art

A designed environment is allowed for XENEON when it is a fixed, versioned, rights-safe PackRat asset and the real product remains obvious.

Allowed:

- approved repository-owned studio scenes
- deterministic monitor/display context behind the device
- gradients, glows, shadows, texture, lines, dots, and geometric treatment
- restrained desk/studio context when it is part of the approved scene
- family-level accent treatment

Not allowed:

- generated room/product imagery
- arbitrary copyrighted game art or cover art
- unrelated stock photography
- fake widget UI or fake floating HUDs
- effects that make the real widget hard to read
- invented XENEON hardware

If a game/product-specific contextual image is ever used, it must be rights-cleared, versioned locally, and have provenance. External cover art is never an automatic fallback.

### XENEON catalog tooling

Current approved catalog/tooling:

- `tools/art/xeneon_hero_catalog.json`
- `tools/art/xeneon_all_hero_batch.py`
- `tools/art/capture_xeneon.mjs`
- `.github/workflows/xeneon-all-heroes-batch.yml`

The catalog config is the naming/order source of truth for the approved XENEON hero batch. Do not maintain a separate hidden product-name table in the workflow.

A new XENEON product is not part of the family until it is added to the catalog and the complete configured batch passes again.

### XENEON browsing-scale gate

The exact 15% sheet is mandatory for this family:

- source hero: `1920 × 960`
- exact 15% review: `288 × 144`

At `288 × 144`:

- product name must be immediately readable
- XENEON device must remain recognizable
- PackRat must remain secondary
- no family member may look like a scale/title outlier

The broader V2 480/320/240 thumbnail review may still be generated where useful, but it does not replace the XENEON exact 15% gate.

### Shared marketplace composition defaults

1. Cover/gallery frames must teach progressively rather than repeat the cover.
2. Gallery 01 should answer `What do I get and why would I want this?` at a glance unless a demo occupies that role.
3. Lead feature space with practical outcomes. Prefer the core job, saved time/visibility, useful controls, history/persistence, meaningful customization, or a real Pro advantage.
4. Search/app icons are utility assets, not gallery content. Never create or intentionally upload a logo-only or icon-only gallery frame.
5. Cover and gallery frames must be distinct. V2 rendering fails on byte-identical marketplace images.
6. Labels beneath screenshots need visible safety spacing.
7. Compatibility/sizes normally comes last for XENEON after value and interaction are understood.
8. Contact sheets follow actual marketplace viewing order.
9. XENEON hero candidates must pass the exact 15% family sheet.

### Feature copy test

Before accepting a feature frame, read only its title and feature points and ask whether a customer can understand the practical value without seeing the rest of the listing.

Run the `SO WHAT?` test on each point. Prefer the useful outcome over implementation trivia.

Feature headlines should normally be 2–6 words. Supporting copy should normally fit one short line, two at most.

Use setup convenience as supporting copy unless setup simplicity is itself one of the main buying objections.

## Demo video decision

Recommend demo media when the product's value materially depends on changing live data, interaction, animation, modes, touch controls, navigation, or state transitions.

Do not add a demo solely because video is available.

When a demo is useful:

- show the real product immediately
- do not spend the opening seconds on a logo animation
- show the primary job first
- then show the strongest second state/mode/interaction
- keep overlays extremely short
- use the same product-first framing language as the hero

Typical useful length is roughly 8–16 seconds, but comprehension controls duration.

Record demo intent in product config/review even when the MP4 is produced by a separate deterministic capture/editing path.

## Descriptions and discoverability

Rat Art review includes the customer-facing listing copy, not only pixels.

Descriptions should begin with a direct one-line value proposition, then only include benefits, contents, setup, compatibility, edition differences, and creator context that affect understanding or purchase confidence.

Do not use generic marketing filler such as `elevate your experience`, `ultimate solution`, `unlock unparalleled control`, or `revolutionize your workflow`.

Do not append raw SEO keyword paragraphs to customer-facing descriptions.

Use actual Marketplace metadata fields/filters for discoverability wherever possible: product type, OS/platform, device, dial support, icon style/theme/color, XENEON orientation/interactivity, and supported search keywords.

## Lite / Pro / Free families

Related editions must look like one family without altering their real UI.

Keep device framing, type system, logo position, background family, title treatment, and platform treatment consistent. Use the actual edition name plus real feature differences to separate editions.

Do not make Pro appear more premium by fabricating a brighter UI or unrelated environment.

## Required preflight

Verify canonical engine imports, required source assets, brand logo, device plate, required captures, exact brand font resolution, and current Marketplace output requirements for the product type.

Missing brand typography is an error. Never silently fall back to Pillow's default bitmap font for marketplace output.

For V2 candidates also verify:

- contact sheet exists
- required thumbnail/browsing-scale sheet exists
- marketplace images are distinct
- any demo recommendation is intentional
- customer-facing description contains no unexplained keyword dump

For approved XENEON heroes additionally verify:

- current product builds
- Rat Art fixture reaches intended state
- `XL_H` capture exists
- hero is exactly `1920 × 960`
- exact `288 × 144` sheet exists
- product name and device pass that 15% review
- provenance metadata records the source capture and approved scene
- no image-generation dependency exists

## Review

Run deterministic QA, inspect every candidate hero, contact sheet, and required thumbnail/browsing-scale sheet, and record visual review results.

Judge instant product clarity, hierarchy, device/product dominance, truthful UI, contextual recognition, crop quality, clutter, brand restraint, text bounds, gallery sequencing, feature usefulness, Lite/Pro relationships, and marketplace polish.

Score V2 with `standards/marketplace-listing-v2.md`:

- Instant product clarity: 20
- Product visibility: 15
- Visual quality: 10
- Marketplace thumbnail performance: 10
- User journey: 15
- Feature communication: 10
- Brand recognition: 10
- Consistency: 5
- Description quality: 5

Target `95+`. Do not pass a mandatory gate because the arithmetic score is high.

If the candidate fails, make an evidence-based correction pass. Normal maximum refinement passes: three.
