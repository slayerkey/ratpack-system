# warm-studio-v1

Reusable PackRat marketplace environment plate.

## Required files

- `base.png` — exact `1920x960` clean environment plate with blank monitor and empty desk.
- `geometry.json` — calibrated monitor, product, and brand placement coordinates.

## Source requirements

`base.png` must contain only the reusable environment: lamp, plants, headphones, blank monitor, dark room, and wood desk. It must not contain product UI, XENEON hardware, Stream Deck hardware, PackRat branding, or product copy.

The scene is presentation context only. Purchased-product proof continues to come from real captures and approved device plates.

## Render flow

```text
base.png
  -> deterministic monitor art / product title
  -> PackRat repository logo
  -> approved XENEON device plate
  -> real captured XENEON UI
  -> final 1920x960 hero
```

Preview with:

```powershell
python tools/art/render_environment_hero.py `
  --scene warm-studio-v1 `
  --shots artifacts/environment-hero/shots `
  --shot XL_H.png `
  --title "PC POWER" `
  --accent-title "METER" `
  --subtitle "for XENEON Edge" `
  --accent "#F2B14B" `
  --out artifacts/environment-hero/pc-power-meter-pro.png
```

The GitHub workflow `.github/workflows/marketplace-environment-hero-preview.yml` builds and captures PC Power Meter Pro before rendering this scene, so the device screen remains real product output.
