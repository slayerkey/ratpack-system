---
name: rat-art
description: Research, stage, render, and visually review PackRat marketplace artwork using deterministic repository tooling only. Never use ImageGen or any image-generation provider for Rat Art.
---

# Rat Art

Rat Art is a repository pipeline, not chat image generation.

## Non-negotiable execution rule

When the user invokes `/rat-art`, asks to use Rat Art, or asks to regenerate marketplace art through the Rat Art pipeline, **do not call ChatGPT image generation, ImageGen, DALL-E, an image API, or any other generative image provider**.

Run the canonical deterministic repository tooling instead. For XENEON widgets the executable path is `tools/art/rat_art.py` plus `tools/art/capture_xeneon.mjs`, normally through `.github/workflows/rat-art-xeneon.yml` so the candidate is produced by GitHub Actions.

If the deterministic pipeline is missing a required asset or capture, fail and fix or migrate that dependency. Never substitute generated artwork.

Read the product, validation evidence, product metadata, brand standards, art reproducibility contract, and applicable platform reference.

## Safety model

Treat live product `marketing/` folders and submitted ship kits as immutable while creating a candidate.

Create an isolated review job or CI artifact for candidate sources, rendered output, provenance, deterministic QA, and visual review.

Do not promote candidate files into live marketing during this skill. Promotion is a separate approved operation.

## Nonwidget products

Use first party contextual screenshots where the current product style calls for context. Preserve source provenance and reject low resolution or unsuitable source images.

Keep PackRat text, device plates, icons, key faces, badges, and layouts deterministic.

Do not use generated images for product keys, text, device representations, marketplace screenshots, or contextual plates.

## XENEON and iCUE widget products

Do not substitute a contextual background for the real widget.

First build the widget and run deterministic browser captures at the required native sizes. Art preflight must fail if those captures are absent.

Composite the real capture into the approved XENEON device plate using the calibrated mapping.

The capture gate must test glyph safety for clipped descenders and other text-bound failures before the marketplace art is rendered.

### Shared marketplace composition defaults

These are repository defaults for future XENEON Rat Art and should not be reimplemented product by product.

1. Footer center branding is the PackRat rat logo only. Do not render the `PACKRAT` wordmark beside it. Hero frames may still keep useful platform labels such as `iCUE WIDGET` and `CORSAIR XENEON EDGE` at the sides.
2. Marketplace sequence is cover first, then the detailed feature or value breakdown, then the broader product showcase, then settings or interaction states, then size compatibility. The gallery should teach more as the customer moves forward rather than repeat the cover.
3. Cover and gallery frames must be distinct. Rat Ship should fail if any generated marketplace image is byte identical to another listing image.
4. Labels beneath screenshots need a visible safety gap from the screenshot frame. Never place a label directly on the screenshot edge.
5. Multi-panel settings and size frames use the shared lower divider and a dedicated footer copy band. Labels stay above the divider, footer copy stays below it, and neither should collide with the main Rat Art footer.
6. The Rat Art contact sheet should follow marketplace viewing order so visual review catches sequencing problems before shipping.

## Required preflight

Verify canonical engine imports, required source assets, brand logo, device plate, required widget captures, and exact brand font resolution.

Missing brand typography is an error. Never silently fall back to Pillow's default bitmap font for marketplace output.

## Review

Run deterministic QA, inspect every candidate hero and contact sheet, and record visual review results.

Judge title legibility, hierarchy, device dominance, contextual recognition, crop quality, clutter, accidental branding, text bounds, gallery sequencing, footer branding, divider consistency, and marketplace polish.

If the candidate fails, make one evidence based correction pass before reporting the blocker.
