# PackRat Marketplace Listing V2 — Audit, Research, and Rollout

Date: 2026-08-28

Status: prototype system implemented on `marketplace/listing-v2`; full live-catalog rollout is source-gated.

## Executive conclusion

PackRat does not need a larger branding exercise. It needs a stricter presentation system.

The strongest current PackRat work already has the correct technical foundation: real product captures, deterministic compositing, reusable device plates, product metadata, QA evidence, and centralized Rat Art. The main weakness is the hierarchy around those truthful assets.

The highest-impact change is:

**Make the real product substantially more dominant, reduce title/marketing chrome, make every later asset answer a new buyer question, and move discoverability work into real Marketplace metadata instead of customer-facing keyword clutter.**

## 1. Current PackRat audit

### What is already strong

- `ratpack-system` is the correct source of truth for shared art rules, product state, QA, and shipping.
- Current XENEON source uses deterministic real widget captures rather than generated mock UI.
- The calibrated XENEON device plate is reusable and truthful.
- Product-level `ART_REVIEW.md`, `rat-art.json`, and `submission.json` already give the system useful places to record claims, presentation choices, and evidence.
- Rat Art already creates contact sheets and can enforce marketplace ordering.
- Existing PackRat branding is restrained enough to evolve instead of redesigning the brand.
- Recent descriptions are technically careful and often disclose genuine platform/provider limitations.

### What is holding conversion back

#### Hero chrome competes with the product

The legacy XENEON renderer automatically makes the full product name a large centered headline, adds a subtitle, then reserves a substantial footer. Even when the device is reasonably large, the composition still reads partly like a title card.

V2 removes the giant repeated product title by default. The Marketplace page already supplies the listing title.

#### Some galleries repeat instead of progress

Now Playing was the clearest example: a strong cover was followed by another nearly identical main-state screenshot under different copy. V2 requires each prime gallery slot to answer a new buyer question.

#### Feature copy can be implementation-led

Technical accuracy remains mandatory, but prime marketplace space should lead with the customer result.

Example direction:

- implementation-first: `Correct energy math`
- customer-first: `SEE WHAT THE WATTS COST`

The proof and caveats remain in the product state, description, and QA.

#### Static asset counts are too uniform

A shared renderer producing five QA images is operationally useful. It should not imply that every customer-facing listing needs the same five ideas. Motion products can use a real demo early; simple products can stay static.

#### Legacy SEO clutter exists

Raw keyword blocks have appeared in customer-facing marketplace prep copy. V2 moves discoverability work into supported Marketplace metadata and keeps descriptions readable.

#### Catalog source-of-truth drift exists

The live Marketplace currently exposes PackRat listings whose current names do not appear that way in `products/index.json`. Examples found during the 2026-08-28 audit include Minimal Icons, Glass Icons, Golden Icons, and Prism Pastel Icons.

Therefore `products/index.json` cannot currently prove the complete active Marketplace catalog by itself. Maker Console's Published list must be reconciled before `FULL_CATALOG_COMPLETE` is claimed.

#### Legacy product source is not fully migrated

`RATPACK.md` records that local `ratpack-projects` and `_shared` remain migration dependencies. The linked GitHub account does not contain another hidden PackRat repository with those missing legacy source/marketing trees.

This affects old published Stream Deck products **and old published XENEON products whose registry IDs no longer have matching `widgets/_src/<id>` directories**.

Those products are `SOURCE_REQUIRED`. Do not regenerate them from memory, old copy, or fabricated UI.

## 2. Current Marketplace research

Primary current sources reviewed:

- Elgato Product Guidelines — https://docs.elgato.com/guidelines/products/
- Managing Products — https://docs.elgato.com/maker-console/managing-products/
- Submitting Products — https://docs.elgato.com/maker-console/submitting-products/
- Stream Deck Plugin Guidelines — https://docs.elgato.com/guidelines/stream-deck/plugins/
- Stream Deck Profile Guidelines — https://docs.elgato.com/guidelines/stream-deck/profiles/
- Stream Deck Icon Guidelines — https://docs.elgato.com/guidelines/stream-deck/icons/
- Marketplace Organization / Maker profile guidance — https://docs.elgato.com/maker-console/organization/
- PackRat maker page — https://marketplace.elgato.com/maker/packrat

Current guidance supports the V2 direction:

- 1920 × 960 PNG marketplace images
- accurate product/function depiction
- accurate Elgato devices
- legible copy
- useful setup information
- avoiding filler/inaccurate AI-generated copy
- using supported tags/metadata for discoverability

Current icon guidance specifically supports describing pack contents and using style/theme/color metadata instead of keyword stuffing the description.

### Strong current listing pattern

Across first-party examples and stronger creator listings, the common strength is compression:

- one obvious idea per frame
- product-specific visual proof
- large readable subject
- short copy
- enough contrast for card-size scanning
- creator identity that does not cover the product

### Common weak-listing pattern

- tiny hardware inside a decorative scene
- giant title copy that repeats the Marketplace title
- several screenshots proving the same thing
- feature cards explaining obvious implementation instead of value
- generic `ultimate / elevate / unlock / revolutionize` language
- setup dominating before the buyer understands why the product is useful
- SEO keyword dumps in customer-facing prose

## 3. PackRat Listing V2 design system

Canonical detailed rules: `standards/marketplace-listing-v2.md`.

### Hero hierarchy

1. real product/device
2. real product UI
3. optional 2–4 word use-case label
4. restrained PackRat mark
5. supporting background

Default hero chrome:

- PackRat mark: top center
- use-case label: top left when useful
- edition/platform: small top right
- product/device: dominant center
- no duplicate PackRat footer logo on the hero

For hardware compositions, target roughly 78–92% of usable canvas width when the form factor allows it.

### Background

Use a restrained dark studio field with subtle product/family ambient accent. No fake HUDs, random desks, rooms, props, particles, or RGB explosions.

### Lite / Pro / Free

Use the same family framing, typography, logo location, background language, and use-case treatment. Edition is a small label. The real UI/function difference does the selling.

### Thumbnail gate

Every V2 hero is reviewed at:

- 480 × 240
- 320 × 160
- 240 × 120

At 320 × 160, the actual product must remain the obvious subject.

## 4. Default user journey

1. HERO — What is this?
2. DEMO / ACTION — What does it actually do? when motion matters
3. CORE VALUE — Why do I care?
4. DIFFERENTIATOR — What makes this more useful than the obvious version?
5. DEPTH — What else matters?
6. EASE — Is setup/use annoying? only if this is a real objection
7. COMPATIBILITY — Will it work for me?
8. TRUST — usually supplied cumulatively by consistent PackRat identity and truthful product media

Do not force every product to contain eight assets.

## 5. Demo system

Recommend video when value materially depends on live data, animation, interaction, modes, navigation, touch controls, or state transitions.

Conceptual structure:

- 0–2 s: real product immediately
- 2–5 s: primary job
- 5–9 s: strongest second state/interaction
- 9–14 s: useful depth/result
- optional short close only if it does not delay understanding

No long logo intro. Overlay copy normally stays at 2–5 words.

The canonical repo does not currently contain a reusable MP4/FFmpeg/demo recorder. V2 therefore records demo intent/beat structure but does not fake motion by crossfading static screenshots. Actual demos require truthful interaction capture.

Prototype decisions:

- Auto Queue for Claude Code: DEMO RECOMMENDED
- Now Playing Panel: DEMO RECOMMENDED
- PC Power Meter Pro: DEMO RECOMMENDED
- Weather Timeline Lite: STATIC IS ENOUGH
- Weather Timeline Pro: DEMO RECOMMENDED

## 6. Feature asset system

Choose the proof format based on the feature:

- static image for visually obvious state
- short real video for motion/state change
- before/after when the difference is the value
- headline + real screen when the UI itself proves the claim
- small checklist only for genuinely useful simple inclusions

Feature headlines should normally be 2–6 words. Run the `SO WHAT?` test before accepting a feature frame.

## 7. Description system

Default structure:

1. direct one-line value proposition
2. 2–5 concise benefits
3. setup only when buyers need it before purchase
4. compatibility/requirements
5. Lite/Pro relationship where relevant
6. short PackRat close

Do not append raw SEO keyword paragraphs. The first sentence should still explain the product when later copy is truncated.

## 8. Representative before / after decisions

### Auto Queue for Claude Code — Stream Deck plugin

Before:

- deterministic product art existed, but the simulated Stream Deck competed with a large marketing-text layout
- the core state transition was not framed as the primary buyer value

V2:

- hero label: `CLAUDE QUEUE`
- large deterministic Stream Deck/key layout is the dominant subject
- benefits progress from queueing → state visibility → queue control → local privacy
- setup moves later and is framed as one-time friction
- demo is recommended because queueing while Claude works and handing off at a turn boundary is inherently temporal

### Now Playing Panel — XENEON

Before:

- full product name dominates the upper hierarchy
- subtitle adds more marketing chrome
- next static frame largely repeats the main state

V2:

- hero label: `MUSIC CONTROL`
- real XENEON product dominates
- PackRat mark is restrained top center
- demo moves immediately after hero when available
- benefit communication leads with track visibility, controls, reactive palettes, and useful idle behavior

### PC Power Meter Pro — complex dashboard

Before:

- technically careful but marketplace copy leads heavily with methodology
- repeated full product-name hero chrome consumes useful hierarchy

V2:

- hero label: `PC POWER`
- small `PRO` edition label
- energy/cost is communicated as the primary reason to care
- measurement-scope accuracy stays as trust proof
- demo is recommended because watts, graph, comparisons, energy, and cost are best understood changing together

### Weather Timeline Lite / Pro — family test

V2:

- both heroes use the same `WEATHER` composition and background family
- restrained `LITE` / `PRO` label changes
- Lite sells the complete 12-hour experience rather than merely saying it is free
- Pro sells 24-hour horizon, tap details, saved locations, and richer solar context
- Lite does not get a video just to match Pro

## 9. Automation implemented

### Shared XENEON renderer

`tools/art/rat_art.py` now supports schema v1 and schema v2.

Schema v1 remains intentionally backward-compatible.

Schema v2 adds:

- short use-case hero labels
- restrained top-center PackRat mark
- edition/platform labels
- larger product/device band
- configurable ambient accent
- compact gallery headers
- product-first feature composition
- V2 contact sheet in marketplace order
- thumbnail review sheet at three card sizes
- duplicate marketplace-image rejection
- demo recommendation in the Rat Art report
- `marketplace-listing-v2` report identity

### Stream Deck prototype renderer

`plugins/claude-auto-queue/scripts/rat_art.py` now follows the same product-first hierarchy and generates its own V2 contact/thumbnail sheets without generative media.

### Rat Art skill

`skills/rat-art/SKILL.md` routes future marketplace art through V2 and explicitly treats missing canonical source as a blocker rather than permission to fabricate.

### Catalog safety automation

`tools/art/marketplace_catalog_audit.py` checks registry products against plausible canonical source directories and emits `SOURCE_AVAILABLE`, `SOURCE_REQUIRED`, or `SOURCE_RULE_UNKNOWN`.

It deliberately does **not** claim the registry equals Maker Console's live Published catalog.

`tools/art/marketplace_catalog_contact_sheet.py` creates a repeatable cross-catalog hero contact sheet from explicit 1920×960 hero inputs.

## 10. Full catalog rollout state

### V2 prototype/source available now

- Auto Queue for Claude Code
- Now Playing Panel
- PC Power Meter Pro
- Weather Timeline Lite
- Weather Timeline Pro

The XENEON four have already passed a full Windows CI build → real capture → deterministic V2 render gate. Auto Queue is under the same CI gate.

### Other source directories currently present in `widgets/_src`

Current GitHub contains newer/migrated widget source such as:

- Agenda Panel
- Desk Notes / Desk Notes Pro
- Helldivers
- Net Dashboard
- OBS Dashboard
- PC Power Meter Lite
- Rig Battery
- Snake
- Work Session Tracker / Work Session Tracker Pro

These directories are useful future V2 candidates **but their presence does not prove they are currently published Marketplace SKUs**.

### Published registry products that are source-gated

Published legacy Stream Deck products include Better Hotkeys & Mouse, profiles such as Valorant/Palworld/DaVinci Resolve, Claude Usage, Screensaver Scheduler, sports trackers, and the old Neon icon series.

Published registry widgets include:

- Market Command Center
- Crypto Portfolio
- Ambient Clock Pack
- Retro Terminal
- Performance Grapher
- AI Usage Dashboard
- Home Assistant Panel

At the time of this audit, those old widget IDs do **not** have matching current `widgets/_src/<id>` directories. They are therefore `SOURCE_REQUIRED` too, even though some are visibly live on the Marketplace.

Do not regenerate any of these products from memory.

### Live Marketplace products discovered outside current registry naming

Marketplace search currently surfaces PackRat products including:

- Minimal Icons
- Glass Icons
- Golden Icons
- Prism Pastel Icons

Additional live products may exist. This is evidence of registry drift, not a complete replacement for Maker Console's Published list.

### Full-catalog completion gate

Before marking `FULL_CATALOG_COMPLETE`:

1. Read/export Maker Console's Published product list.
2. Reconcile every live SKU into `products/index.json`.
3. Migrate/mount remaining `ratpack-projects` / `_shared` source and marketing assets.
4. Run `marketplace_catalog_audit.py` and clear all source blockers for active SKUs.
5. Regenerate only from real current source.
6. Render every V2 hero/contact/thumbnail sheet.
7. Build one cross-catalog hero sheet.
8. Fix visual outliers.
9. Update Maker Console media/descriptions product by product.
10. Verify the public Marketplace after propagation.

## 11. Maker identity

Current public maker copy includes generic language such as `elevate your setup`.

Recommended direction:

`Useful Stream Deck tools, profiles, icon packs, and XENEON Edge widgets — built by PackRat to make your setup more useful without making it more complicated.`

Keep support/social links in maker/profile fields instead of placing URLs in listing art.

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

Target: 95+.

Mandatory failures override arithmetic score.

The final prototype score should only be assigned after the Stream Deck and XENEON rendered contact/thumbnail sheets are all visually inspected.

## 13. Remaining owner-bound inputs

The logo is **not blocked**. The current PackRat rat/package vector was positively identified in `slayerkey/packrat-site/assets/packrat-logo.svg`; the existing Rat Art PNG is a renderer-friendly derivative.

The two genuine inputs required for a literal every-live-listing rollout are:

1. the unmigrated legacy `ratpack-projects` / `_shared` source and marketing tree (or its migration/mount into the canonical environment), and
2. the Maker Console Published-product list/export so the live catalog can be reconciled against `products/index.json`.

Neither blocker should stop the V2 system or source-available prototypes from moving forward.
