# ChatGPT Project Routing for RatPack

GitHub remains the canonical source of truth. ChatGPT Projects are context workspaces, not separate repositories.

## Recommended project split

Do not create one ChatGPT Project per individual product.

Use one ChatGPT Project per platform family.

### PackRat XENEON Edge

Use for all CORSAIR iCUE / XENEON Edge widget products.

Every new product gets:

* one dedicated chat
* one Git branch: `product/<slug>`
* source under `widgets/_src/<slug>/`
* generated shipping output under `widgets/<slug>/`

Fresh chats read `XENEON.md` first after `RATPACK.md`.

### PackRat Stream Deck

Use for Stream Deck marketplace products including plugins, profiles, icon packs, screensavers, and other Stream Deck-native products.

Every new product gets:

* one dedicated chat
* one Git branch: `product/<slug>`
* the matching Stream Deck build/QA path based on product type

Fresh chats read `STREAMDECK.md` first after `RATPACK.md`.

## Why not one giant project

XENEON and Stream Deck share RatPack standards, art, product state, pricing research, and shipping philosophy, but their implementation contracts are materially different.

XENEON uses iCUE providers, eight XENEON slot compositions, CORSAIR widget packaging, and StreamSpell verification.

Stream Deck products use Stream Deck SDK/profile/icon tooling, different manifests, different package types, and different host validation.

Keeping them in separate ChatGPT Projects reduces cross-platform context bleed while preserving shared GitHub standards.

## Why not one project per product

Product-level ChatGPT Projects create unnecessary setup and context duplication.

The product itself should be isolated by chat and Git branch, not by creating another project workspace.

## Shared system

Both projects use the same GitHub repository:

`slayerkey/ratpack-system`

Shared canonical files include:

* `RATPACK.md`
* `products/index.json`
* `skills/rat-validate/SKILL.md`
* `skills/rat-art/SKILL.md`
* `skills/rat-qa/SKILL.md`
* `skills/rat-ship/SKILL.md`
* shared product state and engineering standards

Platform-specific entry files route the rest.

## Recommended chat pattern

A new product chat should begin with a short natural request, not a giant copied workflow prompt.

XENEON example:

`Build a XENEON Edge widget for <idea>. Read RATPACK.md and XENEON.md in slayerkey/ratpack-system and follow RatPack end to end.`

Stream Deck example:

`Build a Stream Deck <plugin/profile/icon pack> for <idea>. Read RATPACK.md and STREAMDECK.md in slayerkey/ratpack-system and follow RatPack end to end.`
