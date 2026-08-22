---
name: rat-art
description: Research, stage, render, and visually review Packrat marketplace artwork using deterministic compositors and immutable live marketing folders.
---

# Rat Art

Read the product, validation evidence, registry entry, brand standards, art reproducibility contract, and applicable platform reference.

## Safety model

Treat live product `marketing/` folders and submitted ship kits as immutable while creating a candidate.

Create an isolated review job for candidate sources, rendered output, provenance, deterministic QA, and visual review.

Do not promote candidate files into live marketing during this skill. Promotion is a separate approved operation.

## Nonwidget products

Use first party contextual screenshots where the current product style calls for context. Preserve source provenance and reject low resolution or unsuitable source images.

Keep Packrat text, device plates, icons, key faces, badges, and layouts deterministic.

Do not use generated images for product keys, text, device representations, or marketplace screenshots. Current canonical migration follows the deterministic researched screenshot model until an explicit policy change is approved.

## XENEON and iCUE widget products

Do not substitute a contextual background for the real widget.

First build the widget and run deterministic browser captures at the required native sizes. Art preflight must fail if those captures are absent.

Composite the real capture into the approved XENEON device plate using the existing calibrated mapping.

## Required preflight

Verify canonical engine imports, required source assets, brand logo, device plate, required widget captures, and exact brand font resolution.

Missing brand typography is an error. Never silently fall back to Pillow's default bitmap font for marketplace output.

## Review

Run deterministic QA, inspect every candidate hero and contact sheet, and record visual review results.

Judge title legibility, hierarchy, device dominance, contextual recognition, crop quality, clutter, accidental branding, text bounds, and marketplace polish.

If the candidate fails, make one evidence based correction pass before reporting the blocker.
