# PackRat Marketplace Environment Scene Renderer

## Goal

Reproduce premium lifestyle marketplace heroes like the approved warm desk concept while preserving PackRat's deterministic product-truth guarantees.

The target composition is:

- a fixed premium workspace environment
- a real monitor behind the product used as the title surface
- a very large real XENEON Edge or Stream Deck product in the foreground
- a small PackRat mark
- optional minimal keyboard/mouse foreground context
- real product UI only

The environment can be photographic or generated, but the purchased product, its UI, key states, widget states, product claims, and branding are always composited deterministically from repository-controlled sources.

## Current reusable pieces

The existing XENEON pipeline already provides the core truth-preserving path:

`capture_xeneon.mjs` -> real slot capture -> `render_device()` -> calibrated XENEON device plate.

Do not replace this path. Extend the composition around it.

The current V2 hero renderer is a flat studio treatment. Add an opt-in scene mode rather than breaking the existing renderer.

## Proposed scene package

Add repository-controlled scene packages:

```text
tools/art/scenes/
  warm-studio-v1/
    base.png
    foreground.png              # optional keyboard/mouse or desk-edge occlusion
    geometry.json
    provenance.json
```

`base.png` should contain the environment only:

- desk
- lamp
- plants
- headphone stand/headphones
- blank monitor hardware/screen area
- room lighting

It must not contain:

- PackRat product UI
- XENEON widget UI
- Stream Deck key UI
- product title text
- PackRat logo
- claims or feature text

This lets Python own all customer-facing product proof and typography.

## Scene geometry

`geometry.json` should define deterministic placement zones, for example:

```json
{
  "canvas": [1920, 960],
  "monitor_quad": [360, 34, 1562, 34, 1562, 390, 360, 390],
  "title_safe_box": [420, 56, 1502, 360],
  "product_box_xeneon": [55, 405, 1865, 875],
  "product_box_streamdeck": [500, 420, 1420, 890],
  "logo_anchor": [1825, 66],
  "foreground_mode": "optional"
}
```

Use a quadrilateral transform when the monitor is not perfectly front-on. A front-facing scene can use a simple rectangle.

## XENEON render path

For XENEON Edge:

1. Build the real widget from canonical source.
2. Capture `XL_H.png` with Playwright using the existing Rat Art fixture.
3. Composite that capture into the approved XENEON Edge plate using the existing `render_device()` implementation.
4. Scale the finished device to approximately 92-96% of the 1920 px canvas width when the scene allows it.
5. Place it in the lower half of the canvas so the screen itself is as large as practical.
6. Composite the title artwork into the monitor behind it.
7. Add the PackRat mark at the scene-defined anchor.
8. Optionally add a restrained foreground keyboard/mouse overlay after the product.

The XENEON screen remains the real captured widget. The environment is presentation only.

## Monitor title surface

Do not bake title text into generated background imagery. Draw it in Python so it is always crisp and correct.

For the warm-studio reference:

```text
ULTIMATE        white
BUNDLE          orange
for XENEON Edge white / muted
```

The monitor can have a deterministic dark background with restrained orange wave/mesh decoration. This can be rendered with Pillow and then transformed into the monitor quad.

This produces the same visual effect as the reference while avoiding AI typography artifacts.

## Rat Art config extension

Keep schema v2 compatible and add an optional scene style under `hero`:

```json
{
  "hero": {
    "style": "environment_monitor",
    "scene": "warm-studio-v1",
    "shot": "XL_H.png",
    "title_lines": [
      {"text": "ULTIMATE", "color": "#FFFFFF"},
      {"text": "BUNDLE", "color": "#F47A00"}
    ],
    "subtitle": "for XENEON Edge",
    "logo_position": "scene",
    "product_scale": 0.96,
    "foreground": "keyboard_mouse_subtle"
  }
}
```

Products that do not specify `hero.style` continue using the current V2 renderer unchanged.

## Renderer implementation

Add shared functions to `tools/art/rat_art.py`:

```text
load_scene(scene_id)
render_monitor_title(...)
warp_into_quad(...)
render_environment_hero_xeneon(...)
render_environment_hero_streamdeck(...)
```

Then route from `hero_v2()` based on `hero.style`.

The renderer should fail closed if the scene asset, geometry, provenance, device plate, or real product capture is missing.

## Stream Deck version

The same environment system should support Stream Deck, but the current Auto Queue art uses a deterministic drawn deck rather than an approved physical device plate.

Add a reusable real-device layer:

```text
tools/art/assets/stream-deck-mk2-straight.png
tools/art/assets/stream-deck-mk2-keys.json
```

The JSON defines the 15 key screen rectangles/quads.

The Stream Deck renderer should:

1. Load the approved transparent hardware plate.
2. Load real product key images/states from the plugin/profile or deterministic product fixture.
3. Composite each real key image into its calibrated key rectangle.
4. Render the resulting Stream Deck large in the same `warm-studio-v1` scene.
5. Put the product name/use case on the monitor behind the device.

For products such as Claude Auto Queue, existing deterministic key-state logic can be reused initially, but the final marketplace scene should move from a fully drawn fake chassis to the approved hardware plate.

## Scene asset provenance

Every environment scene must have `provenance.json` describing whether it is:

- PackRat-owned photography
- licensed photography
- PackRat-created/generated background art

A generated environment is allowed only as presentation context. It cannot contain product UI, key states, claims, product branding, or fabricated hardware details that are being presented as proof.

## QA gates

Generate and verify:

- 1920x960 hero
- 480x240
- 320x160
- 240x120
- exact 15% review at 288x144 when comparing experiments

For the environment hero, additionally fail review when:

- the XENEON screen is materially smaller than the current product-first hero
- title text becomes unreadable at 320x160
- generated/background content overlaps or obscures real UI
- product hardware differs from the approved plate
- monitor-title typography is baked into a generated scene instead of deterministic

## Migration strategy

Do not roll this out globally immediately.

Prototype in this order:

1. XENEON Edge Ultimate Bundle using `warm-studio-v1`.
2. PC Power Meter Pro using the same scene.
3. Claude Auto Queue / representative Stream Deck plugin using the same scene and a new approved Stream Deck plate.
4. Compare all three at full size and 15% scale.
5. If the scene system wins, promote `environment_monitor` to an approved V2 hero style and render representative products before catalog rollout.
