# Discord Voice Panel QA

## Build state

Product: Discord Voice Panel

Slug: `discord-panel`

Branch: `product/discord-panel`

Manifest author: `PackRat 🐀`

Version: `0.2.0`

Current state: automatic current-channel loopback transport implemented. Awaiting the real StreamKit public RPC companion feasibility result and physical XENEON Edge smoke test.

## Previous layout proof retained

The visual product and responsive CSS were intentionally preserved from the original Discord RPC build.

Fixture: 12 voice members, including speaking, self-muted, self-deafened, long names, and descender-heavy text.

PASS: all eight official XENEON viewport compositions reached the voice state with all 12 members represented.

PASS: zero document or body overflow across all eight compositions.

PASS: zero browser runtime exceptions across all eight compositions.

PASS: zero browser console errors across all eight compositions.

PASS: speaker promotion and the 900 ms anti-jitter hold across all eight compositions.

PASS: mute and deafen touch interaction through deterministic fixture hooks across all eight compositions.

PASS: member detail open and close interaction across all eight compositions.

Touch target measurements from that gate:

| Slot | Viewport | Minimum mute/deafen target |
| --- | --- | --- |
| S horizontal | 840x344 | 72 px |
| S vertical | 696x416 | 72 px |
| M horizontal | 840x696 | 88 px |
| M vertical | 696x840 | 88 px |
| L horizontal | 1688x696 | 98 px |
| L vertical | 696x1688 | 102 px |
| XL horizontal | 2536x696 | 104 px |
| XL vertical | 696x2536 | 106 px |

Recent activity remains intentionally hidden on S, M, and L and visible on both XL compositions. XL roster rendering uses two columns.

## Current live transport implementation

PASS by implementation review: the widget no longer attempts Discord OAuth or direct Discord localhost WebSocket RPC.

PASS by implementation review: live transport is only `ws://127.0.0.1:17483` to the PackRat Discord Bridge.

PASS by implementation review: the fixed Server ID and Voice Channel ID settings from the abandoned overlay fallback have been removed.

PASS by implementation review: an unauthenticated bridge snapshot puts the panel in a deliberate Connect Discord state.

PASS by implementation review: after companion authentication, the widget consumes the companion's current selected voice channel automatically.

PASS by implementation review: current roster snapshots are normalized into the existing member model rather than redesigning the UI.

PASS by implementation review: speaking changes retain speaker promotion and the 900 ms hold behavior.

PASS by implementation review: mute and deafen touch actions send only loopback commands to the companion; the XENEON widget never holds Discord credentials.

PASS by implementation review: leaving voice produces a calm not-in-voice state instead of an error.

PASS by implementation review: the local `verify.mjs` rejects regressions back to fixed-channel configuration or direct Discord OAuth/RPC.

## Canonical local test path

First prove the companion:

```text
rat dev discord-bridge
```

A successful companion must reach `discord.authenticated: true` and `streamkit.stage: ready`, then automatically populate its current channel after joining Discord voice.

Then run:

```text
rat dev discord-panel
```

Rat Dev runs `verify.mjs`, rebuilds the flattened widget with `tools/xeneon/inline.py`, runs the official CORSAIR validator, packages with the official CORSAIR CLI, stores the package under `out/dev/packages/discord-panel`, and opens it for iCUE import.

## Physical XENEON gate

Prove on real iCUE/XENEON:

1. widget connects to the loopback companion
2. current Discord channel name appears automatically
3. real member names and avatars populate the roster
4. member joins/leaves update without reloading the widget
5. real speaking changes animate and reorder correctly
6. Mute touch changes the actual Discord mute state
7. Deafen touch changes the actual Discord deafen state
8. changing Discord voice channels changes the panel automatically
9. leaving voice returns to the idle state
10. bridge and widget reconnect after host restarts

## Release gates after live feasibility

After the physical spike passes, rerun the complete eight-size browser suite against final loopback fixtures, regenerate the flattened shipping HTML, run official CORSAIR validation/package, StreamSpell packaged verification, Rat Art, and Rat Ship.

The companion itself also needs its final official Stream Deck SDK migration, release packaging, and a policy/terms review for the chosen Discord authorization identity before this can be called a release candidate.
