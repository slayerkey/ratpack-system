# PackRat Lite → Pro audit — 2026-09-01

This is the durable portfolio ledger for the Lite/Free synchronization and upsell audit.

## Rules

- Pro is the technical source of truth only for verified editions of the same product.
- Standalone free products do not receive invented Pro upsells.
- Lite must preserve shared bug/stability fixes without exposing Pro-only features.
- A Lite upsell may ship only with a verified direct public Elgato Marketplace product URL.
- Marketplace search URLs, creator pages, generic `/icue` destinations and placeholder URLs are not valid Pro destinations.
- Missing publication data fails closed at shipping time; it must not be guessed.

## Catalog classification

| Lite / Free | Platform | Pro counterpart | Classification | Canonical state | Marketplace link state |
|---|---|---|---|---|---|
| Better Hotkeys & Mouse | Stream Deck | Better Hotkeys & Mouse Pro | Lite → Pro | both published | direct URLs not yet captured in RatPack |
| DaVinci Resolve Lite | Stream Deck profile | DaVinci Resolve Pro | Lite → Pro | both published | both direct URLs verified |
| Window Manager Lite | Stream Deck | Window Manager Pro | Lite → Pro | both submitted | direct URLs not public/verified |
| Workflow Automation Lite | Stream Deck | Workflow Automation Pro | Lite → Pro | both submitted | direct URLs not public/verified |
| Calendar Sync Lite | Stream Deck | Calendar Sync Pro | Lite → Pro | both submitted | direct URLs not public/verified |
| Epic Pen Profile | Stream Deck profile | Epic Pen Pro Profile | Lite → Pro | both submitted | direct URLs not public/verified |
| Claude & OpenAI Cost Monitor | Stream Deck | Claude & OpenAI Cost Pro | Lite → Pro | both validated | direct URLs not public/verified |
| Weather Timeline Lite | XENEON Edge | Weather Timeline Pro | Lite → Pro | both qa_passed | Marketplace product IDs known; direct public URLs not verified |
| Work Session Tracker Lite | XENEON Edge | Work Session Tracker Pro | Lite → Pro | both qa_passed | Marketplace product IDs known; direct public URLs not verified |
| Desk Notes Lite | XENEON Edge | Desk Notes Pro | Lite → Pro | both qa_passed | Lite product ID known; Pro product ID/direct URL missing |
| PC Power Meter Lite | XENEON Edge | PC Power Meter Pro | Lite with unregistered Pro | Lite qa_passed; Pro source exists but is absent from canonical product index | direct Pro URL not verified |
| Clipboard Manager | Stream Deck | Clipboard Manager Pro | Lite with unregistered Pro | Lite submitted; no Pro record in canonical index | blocked until Pro product is resolved |
| CS2 Lite clue | Stream Deck | CS2 Pro clue | Ambiguous | no Lite/Pro records in canonical index; only paid CS2 profile exists | resolve from local/Marketplace state before modifying |
| AI Prompts Lite | Stream Deck profile | none singular | Ambiguous multi-product funnel | multiple paid specialist packs + Toolkit | do not invent one Pro counterpart |

## Standalone free

- Discord Essentials — free profile, no verified edition pair.
- PackRat Network Probe — standalone free XENEON widget.
- Retro Terminal — standalone free XENEON widget.
- To-Do List — no canonical Pro counterpart.
- PackRat Discord Bridge — infrastructure/free bridge. Discord Voice Panel and Voice Deck are different paid products, not verified editions of the bridge.

## Obsolete / rejected free

- HWiNFO Monitor — rejected.
- Foundry VTT — rejected.

## XENEON synchronization evidence

The August 27 Marketplace recovery already synchronized and regression-tested the shared Lite/Pro runtime fixes for Desk Notes, Weather Timeline and Work Session Tracker and repaired PC Power Meter Lite. The exact officially packaged artifacts passed official CLI validation/package integrity, lexical iCUE setting regression and Corsair Labs Windows host smoke.

Recovery workflow run: `33130590648`

Recovery source commit: `dde5963fb9582ac56270110d63dd2d8da647ec94`

Current live recovery artifacts (expire 2026-09-27):

| Product | Artifact | SHA-256 |
|---|---|---|
| Weather Timeline Lite | `xeneon-recovery-weather-timeline` | `f3842ec82739794a900a561b15e630f48a543565d2e71c500048e5f775fa38f6` |
| Weather Timeline Pro | `xeneon-recovery-weather-timeline-pro` | `7729bc7d58cfea5e43434f9cd7877ebe335dbc358abab861592b576b88ffbe43` |
| Work Session Tracker Lite | `xeneon-recovery-work-session-tracker` | `064e76f47595567e82e63efa25ae94e6e0661cfb941388af35134fa093215621` |
| Work Session Tracker Pro | `xeneon-recovery-work-session-tracker-pro` | `f7927a234be09ea56b2bd465b035d0595f3d049f7e30293f8db1eb86323525be` |
| Desk Notes Lite | `xeneon-recovery-desk-notes` | `b6486e93e92805565ca0c4a0ba683f4701c46f9c201a7cf924e7c1e5ef409403` |
| Desk Notes Pro | `xeneon-recovery-desk-notes-pro` | `b4e5bd8f00fe5ff153e4c07b6de42afc8bc87af7aededd14bfa1c5e7b825749d` |
| PC Power Meter Lite | `xeneon-recovery-pc-power-meter` | `87266aa31c8e9f5805724db1e4dce4fb6fd9608ef589245ca7d64dee18bb1fa4` |

Known Marketplace product IDs from the recovery ledger:

- Desk Notes Lite: `3926a6a3-5860-4e11-a01b-7e90f8a4c900`
- Weather Timeline Lite: `418f836f-b5fb-4456-b412-9b7fe9295aa0`
- Weather Timeline Pro: `160c8019-ce77-49d8-a306-8ef1764a70c5`
- Work Session Tracker Lite: `e11e003d-5ca3-4c2d-ba94-f37fca8dabc7`
- Work Session Tracker Pro: `f8e12d94-4354-41ca-b6da-beb2297fb9e2`
- PC Power Meter Lite: `113488ed-3043-48b5-96d0-67c2130cc1ed`
- Desk Notes Pro: not captured; recover from Maker Console before recording a direct URL.

### Current XENEON upsell defects

These are release blockers, not reasons to rewrite the already-tested shared runtimes:

- Weather Timeline Lite source uses a Marketplace search URL and the shared core retains a `REPLACE_WITH_WEATHER_TIMELINE_PRO` fallback.
- Work Session Tracker Lite uses generic `https://marketplace.elgato.com/icue` and displays an always-visible runtime upgrade row.
- Desk Notes Lite uses the generic PackRat creator page; its info-overlay placement is otherwise appropriately restrained and the shared runtime already supports disabling the button when the URL is empty.
- PC Power Meter Lite uses a Marketplace search URL. Pro source exists but Pro is not registered in the canonical product index.

Do not patch these to guessed URLs. Once a direct public Pro page exists, update the canonical relationship map and product source together, then regenerate/retest the exact package.

## Verified direct Marketplace pair

DaVinci Resolve Lite:
`https://marketplace.elgato.com/product/davinci-resolve-lite-f76cfeae-614a-4381-ab7a-a8e8d6298285`

DaVinci Resolve Pro:
`https://marketplace.elgato.com/product/davinci-resolve-pro-b703cfa1-1e25-4c62-b26d-30a70ab33933`

## Source-access blockers

The connected canonical repository does not contain shipping source for the older Stream Deck catalog products listed below, and no separate repositories for them are available through the authenticated GitHub installation:

- Better Hotkeys & Mouse Lite/Pro
- Clipboard Manager / proposed Pro
- Window Manager Lite/Pro
- Workflow Automation Lite/Pro
- Calendar Sync Lite/Pro
- Epic Pen free/Pro profile source
- Claude & OpenAI Cost Monitor/Pro
- CS2 Lite/Pro clue

Those products cannot be truthfully rebuilt, diffed, built or packaged from this GitHub-only environment. Resolve them from the local RatPack product folders / current Marketplace packages and register their canonical source if they remain active products.

## Future protection

`products/lite-pro-map.json` is now the canonical commercial-edition relationship layer.

`tools/lite_pro_audit.py` checks:

- Lite/Pro registry consistency
- free Lite vs paid Pro pricing
- valid direct Marketplace product URL shape
- search URLs
- creator-page URLs
- generic `/icue` destinations
- placeholder markers such as `REPLACE_WITH` and `TODO_PRO_URL`
- missing/unregistered Pro records
- ambiguous relationships

Normal audit mode reports unresolved publication state without blocking ordinary development. Strict `--shipping <lite-id>` mode fails closed unless the relationship is a true Lite → Pro pair, Pro is published, both direct Marketplace URLs are recorded, and mapped source paths contain no invalid upgrade destination.

`.github/workflows/lite-pro-audit.yml` runs the portfolio check on relevant pull requests and main changes, and supports a strict manual shipping preflight.
