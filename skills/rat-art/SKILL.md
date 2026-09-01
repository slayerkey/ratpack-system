---
name: rat-art
description: Research, stage, render, and visually review PackRat marketplace artwork using deterministic repository tooling only. Never use ImageGen or any image-generation provider for Rat Art.
---

# Rat Art

Rat Art is a repository pipeline, not chat image generation.

## Non-negotiable execution rule

When the user invokes `/rat-art`, asks to use Rat Art, or asks to regenerate marketplace art through the Rat Art pipeline, **do not call ChatGPT image generation, ImageGen, DALL-E, an image API, or any other generative image provider**.

Run the canonical deterministic repository tooling instead. For XENEON widgets the executable path is `tools/art/rat_art.py` plus `tools/art/capture_xeneon.mjs`, normally through the canonical Rat Ship or Rat Art workflow.

If the deterministic pipeline is missing a required asset or capture, fail and fix or migrate that dependency. Never substitute generated artwork.

Read the product, validation evidence, product metadata, `standards/marketplace-listing-v2.md`, brand standards, art reproducibility contract, and applicable platform reference.

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

→ RESTRAINED BACKGROUND / LIGHTING

→ MINIMAL COPY / BRANDING

Never alter layout, controls, metrics, modes, values, availability, or behavior in a way that misrepresents the product.

If a claim needs a state that is not available in canonical source/captures, block or remove the claim rather than inventing proof.

## Nonwidget products

Use first party contextual screenshots where the current product style calls for context. Preserve source provenance and reject low resolution or unsuitable source images.

Keep PackRat text, device plates, icons, key faces, badges, and layouts deterministic.

Do not use generated images for product keys, text, device representations, marketplace screenshots, or contextual plates.

For Stream Deck plugins and profiles, the key cluster/device must be large enough to read as the product rather than decoration.

For icon packs, the icons themselves are the product. Show meaningful variety at readable key-like scale; do not bury them in a tiny device or a wall of hundreds of indistinguishable thumbnails.

## XENEON and iCUE widget products

Do not substitute a contextual background for the real widget.

First build the widget and run deterministic browser captures at the required native sizes. Art preflight must fail if those captures are absent.

Composite the real capture into the approved XENEON device plate using the calibrated mapping.

The capture gate must test glyph safety for clipped descenders and other text-bound failures before the marketplace art is rendered.

### V2 hero composition

For schema-v2 XENEON art:

1. Keep the PackRat rat/package mark restrained at top center.
2. Use a short use-case label at top left only when it improves instant understanding.
3. Keep edition/platform labeling small at top right.
4. Make the front-facing device the dominant visual, normally about 78–92% of usable width when the form factor allows it.
5. Do not repeat the PackRat mark in the hero footer.
6. Keep the background a restrained studio gradient/ambient field; no random desks, props, particles, fake HUD elements, or decorative UI.
7. Generate a thumbnail review sheet at 480×240, 320×160, and 240×120.

The marketplace title already names the product. Do not automatically render the full product name at poster scale.

Use `hero.title_mode`:

- `none` when real UI plus listing title is enough.
- `use_case` for a short label such as `PC POWER`, `WEATHER`, `AI USAGE`, or `MUSIC CONTROL`.
- `product` only when repeating the actual product name materially improves clarity.

### Shared marketplace composition defaults

1. Gallery footer center branding is the PackRat rat logo only. Do not render the `PACKRAT` wordmark beside it.
2. Cover/gallery frames must teach progressively rather than repeat the cover.
3. Gallery 01 should answer `What do I get and why would I want this?` at a glance unless a demo occupies that role.
4. Lead feature space with practical outcomes. Prefer the core job, saved time/visibility, useful controls, history/persistence, meaningful customization, or a real Pro advantage.
5. Search/app icons are utility assets, not gallery content. Never create or intentionally upload a logo-only or icon-only gallery frame.
6. Cover and gallery frames must be distinct. V2 rendering fails on byte-identical marketplace images.
7. Labels beneath screenshots need visible safety spacing.
8. Compatibility/sizes normally comes last for XENEON after value and interaction are understood.
9. Contact sheets follow actual marketplace viewing order.
10. V2 hero candidates must also pass the generated thumbnail sheet.

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

Keep device framing, type system, logo position, background family, and use-case label treatment consistent. Use a restrained edition label plus real feature differences to separate editions.

## Required preflight

Verify canonical engine imports, required source assets, brand logo, device plate, required captures, exact brand font resolution, and current Marketplace output requirements for the product type.

Missing brand typography is an error. Never silently fall back to Pillow's default bitmap font for marketplace output.

For V2 candidates also verify:

- contact sheet exists
- thumbnail sheet exists
- hero remains product-dominant at 320×160
- marketplace images are distinct
- any demo recommendation is intentional
- customer-facing description contains no unexplained keyword dump

## Review

Run deterministic QA, inspect every candidate hero, contact sheet, and V2 thumbnail sheet, and record visual review results.

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
