# PackRat Marketplace Listing V2 — Audit, Research, and Rollout

Date: 2026-08-28

Status: prototype implementation in progress on `marketplace/listing-v2`

## Executive conclusion

PackRat does not need a larger branding system. It needs a stricter presentation system.

The strongest existing PackRat work already has the right technical foundation: real product captures, deterministic compositing, reusable device plates, centralized Rat Art, product metadata, QA, and shipping evidence. The main weakness is the information hierarchy around those truthful assets.

The highest-impact change is simple:

**Make the actual product substantially more dominant, reduce title/marketing chrome, make every later asset answer a new buyer question, and move discoverability work into real Marketplace metadata rather than customer-facing keyword clutter.**

## 1. Current PackRat audit

### What is already strong

- `ratpack-system` is the correct source of truth for shared art, product state, QA, and shipping.
- XENEON products already use deterministic real widget captures rather than generated mock UI.
- The calibrated XENEON device plate is reusable and truthful.
- Existing ART_REVIEW files document provenance and reject misleading states.
- Rat Art already creates contact sheets and enforces a deliberate gallery sequence.
- Current footer branding is restrained to the rat mark instead of a repeated giant PACKRAT wordmark.
- Several recent product descriptions are technically careful and disclose real platform/provider limitations.
- The PackRat maker identity already exists publicly and the customer-facing PackRat site has a clear human tone.

### What is holding conversion back

#### Hero chrome competes with the product

The current XENEON renderer automatically makes the full product name the largest element at the top of every hero, adds a subtitle, then reserves a substantial footer. Even when the device is large, the composition reads partly like a title card rather than a product view.

V2 removes the giant repeated title by default. The listing title already names the product.

#### Some galleries repeat the hero before teaching anything new

Now Playing is the clearest example. The current cover already shows the full product strongly, then the next static frame shows nearly the same primary state under a different headline. That is wasted attention.

V2 makes the second asset answer a new question: practical value or product-in-action, with video inserted immediately after the hero when motion is genuinely useful.

#### Feature copy is sometimes too implementation-led

Existing XENEON copy is honest but often explains why the implementation is careful before communicating the customer result.

Example direction:

- from: `Correct energy math`
- toward: `SEE WHAT THE WATTS COST`

The technical truth still belongs in the description/QA, but the marketplace visual should lead with why the buyer cares.

#### Static asset counts are treated too uniformly

The existing shared XENEON renderer always produces the same five marketplace images. That is useful operationally but should not imply that every product needs the same five customer-facing ideas.

V2 keeps deterministic output for QA while allowing the actual listing journey to choose whether demo media replaces or supplements a static frame.

#### Legacy SEO clutter exists

At least one current marketplace prep document appends a raw keyword line at the bottom of the customer-facing description. This should be metadata, not prose.

V2 explicitly prohibits unexplained keyword dumps in descriptions.

#### Catalog source-of-truth drift exists

The live Marketplace currently exposes PackRat listings that are not represented by the same current names in `products/index.json` (examples found during the 2026-08-28 audit include Minimal Icons, Glass Icons, Golden Icons, and Prism Pastel Icons).

Therefore `products/index.json` cannot currently prove the complete set of active Marketplace SKUs by itself.

Before final full-catalog migration, reconcile Maker Console's Published product list against the canonical registry.

#### Legacy Stream Deck source is not fully migrated

`RATPACK.md` explicitly records that local `ratpack-projects` and `_shared` remain compatibility dependencies during migration.

The linked GitHub account does not contain another hidden PackRat repository with those legacy source/marketing folders.

Therefore old published plugin/profile/icon listing art must not be regenerated from memory. Mark it `SOURCE_REQUIRED` until the real source tree is migrated or mounted.

## 2. Current Marketplace research

Primary current sources reviewed:

- Elgato Product Guidelines — https://docs.elgato.com/guidelines/products/
- Managing Products — https://docs.elgato.com/maker-console/managing-products/
- Submitting Products — https://docs.elgato.com/maker-console/submitting-products/
- Stream Deck Plugin Guidelines — https://docs.elgato.com/guidelines/stream-deck/plugins/
- Stream Deck Profile Guidelines — https://docs.elgato.com/guidelines/stream-deck/profiles/
- Stream Deck Icon Guidelines — https://docs.elgato.com/guidelines/stream-deck/icons/
- Marketplace Organization / Maker profile guidance — https://docs.elgato.com/maker-console/organization/
- PackRat live maker page — https://marketplace.elgato.com/maker/packrat

### Marketplace rules that directly support V2

Elgato's current product guidance explicitly requires/recommends:

- 1920 × 960 PNG thumbnails/gallery images
- accurate depiction of the product and its functionality
- accurate Elgato devices
- clear, legible text
- useful setup guidance in descriptions
- avoiding unhelpful filler and inaccurate AI-generated description copy
- using tags/metadata for discoverability on supported product types

Current icon guidance explicitly recommends describing icon count/content and using color/style/theme tags for discoverability.

Current Maker Console guidance makes product metadata, media, release notes, and product management separate surfaces. That supports keeping SEO/discoverability data out of customer-facing paragraphs.

### What strong current listings do well

Across first-party Elgato examples and stronger creator listings, the recurring useful pattern is not elaborate branding. It is compression:

- one obvious product idea per frame
- product-specific visual proof
- large readable subject
- short headline
- enough contrast to scan at card size
- consistent creator identity without covering the product

### Common weak-listing failure modes

- tiny hardware inside a large decorative scene
- giant product-name typography that repeats the Marketplace title
- feature cards that explain obvious functionality instead of value
- several screenshots that prove the same thing
- generic `ultimate / elevate / unlock` copy
- setup instructions dominating before the buyer understands why the product is useful
- keyword stuffing at the bottom of descriptions

## 3. Final PackRat Listing V2 design system

Canonical detailed rules live in `standards/marketplace-listing-v2.md`.

### Hero

Default V2 hierarchy:

1. real product/device
2. real UI
3. optional 2–4 word use-case label
4. restrained PackRat mark
5. background

Default hero chrome:

- PackRat mark: top center
- use-case label: top left when useful
- edition/platform: small top right
- device/product: dominant center
- no duplicate hero-footer logo

The product should normally occupy about 78–92% of usable width for a hardware composition when the form factor allows it.

### Background

Restrained dark studio field with subtle family/product ambient accent.

No fake HUDs, random desks, rooms, props, particles, or RGB explosions.

### Lite / Pro / Free

Same family framing, typography, logo location, background language, and use-case label.

Edition is a small badge/label. The actual product UI remains truthful.

### Thumbnail gate

Every V2 hero generates a review sheet at:

- 480 × 240
- 320 × 160
- 240 × 120

The 320 × 160 view is the practical decision gate. If the product stops being obvious, simplify the hero rather than adding more text.

## 4. User journey

Default journey:

1. HERO — What is this?
2. DEMO / ACTION — What does it actually do? (only when motion/state is meaningful)
3. CORE VALUE — Why do I care?
4. DIFFERENTIATOR — What makes this better/more useful than the obvious version?
5. DEPTH — What else can it do that matters?
6. EASE — Is setup/use annoying? (only when this is a real objection)
7. COMPATIBILITY — Will this work in my setup?
8. TRUST — Usually handled by consistent PackRat identity + maker profile rather than a dedicated poster

Do not force every product to have eight assets.

## 5. Demo system

Recommend demo media when value depends on live data, animation, interaction, modes, navigation, touch controls, or state transitions.

Typical structure:

- 0–2 s: product immediately
- 2–5 s: primary job
- 5–9 s: strongest second state/interaction
- 9–14 s: depth or result
- optional short ending only if it does not delay understanding

No long intro animation.

Overlay copy: normally 2–5 words.

Prototype decisions:

- Now Playing Panel: DEMO RECOMMENDED
- PC Power Meter Pro: DEMO RECOMMENDED
- Weather Timeline Lite: STATIC IS ENOUGH
- Weather Timeline Pro: DEMO RECOMMENDED for hour details, paging, and saved-location switching

## 6. Feature asset system

Use the format that best proves the feature.

- static image for visually obvious states
- short video for movement/state change
- before/after for transformation
- headline + real screen when UI proves the claim
- small checklist only for simple inclusions

Feature headlines should normally be 2–6 words.

Run the `SO WHAT?` test. Implementation detail moves behind the customer outcome unless the implementation itself resolves a trust objection.

## 7. Description system

Default:

1. direct one-line value proposition
2. 2–5 concise useful benefits
3. setup only if buyers need to know it
4. compatibility/requirements
5. Lite/Pro distinction when relevant
6. `Made by PackRat.` or another short human close

Do not append raw keyword paragraphs.

The first sentence should survive marketplace-card truncation and still explain why the product exists.

## 8. Representative before / after decisions

### Now Playing Panel

Before:

- full product name is the dominant top headline
- subtitle adds another line of marketing chrome
- next static frame largely repeats the main state
- strongest changing behaviors are distributed across later static graphics

V2:

- hero label: `MUSIC CONTROL`
- real XENEON product is the dominant subject
- PackRat mark moves to restrained top center
- demo recommended immediately after hero
- benefit frame leads with track visibility, controls, artist-reactive palettes, and useful idle state
- customer description is materially shorter and removes the raw SEO keyword dump

### PC Power Meter Pro

Before:

- technically excellent, but marketplace copy leads heavily with measurement methodology
- full product-name hero consumes hierarchy that could belong to the real meter

V2:

- hero label: `PC POWER`
- small `PRO` edition label
- energy/cost is communicated as the main reason to care
- accuracy language remains, but as trust proof rather than the first marketing idea
- demo recommended because synchronized live watts, graphs, comparisons, energy, and cost are best understood changing together

### Weather Timeline Lite / Pro

Before:

- family relationship exists in product naming but each listing still follows generic v1 title-card hierarchy
- Lite feature art spends prime space saying `Free should still feel finished`
- Pro feature art spends prime space saying it is the natural upgrade

V2:

- both heroes use the same `WEATHER` family composition and same ambient background family
- only the restrained `LITE` / `PRO` label changes
- Lite sells the complete 12-hour timeline itself, not the fact that it is free
- Pro sells 24-hour horizon, tap details, saved locations, and richer solar context
- Lite does not get a demo just to match Pro

## 9. Automation changes implemented on prototype branch

`tools/art/rat_art.py` now supports schema v1 and v2.

Schema v1 remains intentionally legacy-compatible.

Schema v2 adds:

- short use-case hero labels
- restrained top-center PackRat mark
- edition/platform labeling
- larger product/device band
- configurable ambient accent
- compact gallery headers
- product-first feature composition
- V2 contact sheet in actual marketplace order
- thumbnail review sheet at three card sizes
- duplicate marketplace-image rejection
- demo recommendation recorded in the Rat Art report
- V2 report identity (`marketplace-listing-v2`)

`skills/rat-art/SKILL.md` now routes future migrations through the V2 standard and explicitly treats missing legacy source as a blocker rather than permission to fabricate art.

## 10. Full catalog rollout state

### Prototype / migrated source available

The current branch actively prototypes:

- Now Playing Panel
- PC Power Meter Pro
- Weather Timeline Lite
- Weather Timeline Pro

These have canonical source/captures and can be rendered truthfully in CI.

### Known published products in the canonical registry that still need legacy source reconciliation

The registry includes published Stream Deck products such as:

- Better Hotkeys & Mouse
- Better Hotkeys & Mouse Pro
- Valorant profile
- Palworld profile
- Discord Essentials
- DaVinci Resolve
- DaVinci Resolve Lite
- DaVinci Resolve Pro
- Streamer Starter Pack
- Streamer University
- Claude Usage
- Screensaver Scheduler
- NFL Tracker
- NBA Tracker
- NHL Tracker
- Soccer Tracker
- NASCAR Tracker
- UFC Tracker
- Neon Blue / Green / Pink / Yellow / Black / Purple / White / Red icon packs

Do not regenerate these from memory. Reconcile each with the actual current source/marketing files first.

### Current published XENEON products in registry

Known current published widgets include:

- Market Command Center
- Crypto Portfolio
- Ambient Clock Pack
- Retro Terminal
- Performance Grapher
- AI Usage Dashboard
- Home Assistant Panel

Their current `widgets/_src` source is available in `ratpack-system`, so these are the safest next rollout batch after the V2 prototype passes visual QA.

### Live Marketplace products discovered outside the registry's current naming

Marketplace search currently surfaces PackRat products including:

- Minimal Icons
- Glass Icons
- Golden Icons
- Prism Pastel Icons

Additional live products may exist. This list is evidence of registry drift, not an exhaustive replacement for Maker Console's Published list.

### Full-catalog completion gate

Before marking `FULL_CATALOG_COMPLETE`:

1. Export/read Maker Console's Published product list.
2. Reconcile every live SKU into `products/index.json`.
3. Migrate/mount the remaining local `ratpack-projects` and `_shared` source/marketing folders.
4. Regenerate only from real current source.
5. Render every V2 hero/contact sheet/thumbnail sheet.
6. Build one cross-catalog hero contact sheet.
7. Fix outliers.
8. Update Maker Console media and descriptions product by product.
9. Verify the public Marketplace after propagation.

## 11. Maker identity recommendation

Current public maker copy includes generic language such as `elevate your setup`.

Recommended future maker profile direction:

`Useful Stream Deck tools, profiles, icon packs, and XENEON Edge widgets — built by PackRat to make your setup more useful without making it more complicated.`

Keep support/social links in the maker profile and Marketplace fields rather than placing URLs in listing art.

## 12. QA / score gate

V2 rubric:

- Instant product clarity: 20
- Product visibility: 15
- Visual quality: 10
- Marketplace thumbnail performance: 10
- User journey: 15
- Feature communication: 10
- Brand recognition: 10
- Consistency: 5
- Description quality: 5

Target: 95+ after rendered prototype review.

Do not assign the final numeric score until the CI-rendered V2 contact sheets and thumbnail sheets have been visually inspected.

Mandatory failures override score.

## 13. Remaining owner-bound inputs

The new logo is **not blocked**: the current PackRat rat/package vector was positively identified in `slayerkey/packrat-site/assets/packrat-logo.svg`, with the existing Rat Art PNG treated as a renderer-friendly derivative.

The two genuine inputs required for a literal every-live-listing rollout are:

1. the unmigrated legacy `ratpack-projects` / `_shared` source and marketing tree (or its migration into `ratpack-system`), and
2. the Maker Console Published-product list/export so the live catalog can be reconciled against `products/index.json`.

Neither blocker should stop the V2 system or the already-migrated XENEON catalog from moving forward.
