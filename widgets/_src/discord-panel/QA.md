# Discord Voice Panel QA

## Build state

Product: Discord Voice Panel

Slug: `discord-panel`

Branch: `product/discord-panel`

Manifest author: `PackRat 🐀`

Version: `0.2.0`

Current state: live transport pivot implemented. Awaiting physical XENEON Edge feasibility proof with the StreamKit companion path.

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

## New live transport implementation

PASS by implementation review: the widget no longer attempts Discord OAuth or direct Discord localhost WebSocket RPC.

PASS by implementation review: live transport is only `ws://127.0.0.1:17483` to the PackRat Discord Bridge.

PASS by implementation review: Server ID, Voice Channel ID, and optional Channel Label are configurable through iCUE properties.

PASS by implementation review: settings changes are sent to the companion automatically without reloading the widget.

PASS by implementation review: companion snapshots are normalized into the existing roster model rather than redesigning the UI around StreamKit markup.

PASS by implementation review: speaking state still uses the existing promotion and 900 ms hold behavior.

PASS by implementation review: mute and deafen touch actions send local bridge commands rather than restricted Discord RPC commands.

PASS by implementation review: no Discord token, cookie, Client Secret, or browser credential exists in widget source.

## Current physical gate

Use the canonical commands:

```text
rat dev discord-bridge
rat dev discord-panel
```

The second command builds the canonical flattened widget, runs the official CORSAIR validator, packages it with the official CORSAIR CLI, stores the package under `out/dev/packages/discord-panel`, and opens it for iCUE import.

Then configure the Server ID and Voice Channel ID in the widget and prove:

1. widget connects to the local companion from the real iCUE/XENEON runtime
2. StreamKit helper reaches ready state
3. real member names populate the roster
4. real speaking changes animate and reorder correctly
5. avatars render when available, with initials fallback remaining valid
6. Mute touch toggles Discord while Discord is in the background
7. Deafen touch toggles Discord while Discord is in the background
8. bridge and widget reconnect after host restarts

## Release gates after live feasibility

If the physical spike passes, rerun the complete eight-size browser suite against the new transport fixtures, regenerate the flattened shipping HTML, run official CORSAIR validation/package, StreamSpell packaged verification, Rat Art, and Rat Ship before calling this a release candidate.

The configured-channel limitation must be represented honestly in marketplace copy unless automatic current-channel following is added later.
