# Maker Console direct Widget submission

## Canonical RatPack fact

The live Elgato Maker Console has been directly observed to offer `Widget` as a create-product type and to accept `.icuewidget` packages.

This was confirmed in the existing RatPack Maker Console Playwright driver on 2026-08-11 after the owner inspected the live create-product screen. Existing PackRat iCUE widgets have subsequently been submitted and published through Marketplace.

Public Elgato documentation may lag the live Maker Console product-type roster. Do not use an omitted `Widget` entry in public docs as evidence that widgets require email submission.

When live UI and public docs disagree about whether a product type is selectable in Maker Console, RatPack uses the live authenticated Maker Console as the operational source of truth and records the discrepancy.

## Widget wizard facts already learned

The direct product type label is `Widget`.

The product file is `.icuewidget`.

Widget details have historically required marketplace category, Dashboard Sizes, and Language. Device support comes from the widget manifest rather than the same Device selector used by Stream Deck profiles.

Exact option labels must come from the live wizard or previously confirmed product metadata. Do not guess option strings.

## Automation boundary

The established automation is Playwright with a local persistent Chromium profile under `.playwright-profile`.

That local profile may contain authenticated Maker Console and identity-provider state. Never commit it, upload it, copy it to GitHub Actions, or serialize its cookies or credentials into CI.

GitHub remains responsible for canonical source, QA, package creation, Rat Art, and ship-kit artifacts. The authenticated Maker Console browser driver is a local execution boundary.

The driver may automate draft creation, package upload, listing fields, price, media upload in locked gallery order, version/release notes, and submission when the owner has explicitly requested submission and all pre-submit invariants pass.

For a product-type path that may have changed, prefer a pathfinder/staging run that stops before irreversible fields or final submission, captures accessible controls, and updates the canonical selectors before a full run.
