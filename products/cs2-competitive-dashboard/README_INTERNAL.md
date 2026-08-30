# CS2 Competitive Dashboard Internal State

The product has moved beyond the original profile-planning stage.

Current commercial decision:

* **CS2 Live Stats** remains the existing simpler paid product at $6.99.
* **CS2 Competitive Dashboard Pro** is the premium competitive product at $14.99 one time.
* **CS2 Competitive Dashboard Lite** remains an internal shared-engine build and is not part of the initial Marketplace launch.

Pro already includes validated bundled **Competitive** and **Live Match** profiles for supported Stream Deck device types.

The real Windows Valve GSI transport gate has passed on physical hardware. Do not restart the original GSI feasibility investigation unless new host evidence shows a regression.

Use these files as the current source of truth:

1. `RELEASE.md` for product positioning, price, provider policy, attribution, and final Marketplace gates.
2. `FINAL_HOST_TEST.md` for the single comprehensive Windows physical test.
3. `LEETIFY_COMMERCIAL_CLEARANCE.md` for the remaining paid-use clearance record.
4. `QA.md` and historical host debugging documents for implementation history and regression context.

After the final physical host test passes, run from the plugin directory:

```powershell
npm run host:audit
npm run release:final
```

`host:audit` evaluates the latest real host log. `release:final` intentionally blocks submission until the official unmodified Leetify attribution asset and explicit commercial clearance are present.

Once the physical host gate and final Marketplace gate both pass, stop adding features and ship Pro.
