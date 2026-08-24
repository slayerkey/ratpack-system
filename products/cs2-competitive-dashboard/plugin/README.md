# CS2 Competitive Dashboard Plugin

Shared Stream Deck plugin source for:

- CS2 Competitive Dashboard Pro
- CS2 Competitive Dashboard Lite

## Architecture

Both Marketplace products are generated from one source tree with separate entry points and immutable plugin UUIDs.

- Pro: `com.packrat.cs2-competitive-dashboard-pro`
- Lite: `com.packrat.cs2-competitive-dashboard-lite`

Lite is a compile/build policy restriction, not a fork. Its live metric selector only exposes Score, Health, Money, and Map plus the shared Status action.

## Local live telemetry

The plugin hosts a localhost-only CS2 Game State Integration listener and can generate the required CS2 GSI config automatically.

Default GSI data requests intentionally exclude observer-oriented components such as `phase_countdowns`, `allplayers_*`, `allgrenades`, and the richer `bomb` object.

## Commands

```text
npm install
npm run typecheck
npm test
npm run build
npm run validate
npm run pack
```

`npm run build` generates both `.sdPlugin` directories under `out/`.

`npm run pack` writes both installable `.streamDeckPlugin` packages under `dist/`.

## External data

FACEIT and Leetify are provider interfaces for Pro, not embedded credentials. Production provider credentials must live behind a RatPack-owned gateway.

Leetify-backed paid features remain commercially gated until the items in `../VALIDATION.md` are cleared.
