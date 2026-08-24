# Weather Timeline Lite QA

The CI `network-smoke.mjs` runs the shared deterministic Weather Timeline browser suite against the generated shipping `index.html`.

Automated coverage:

- All eight native XENEON Edge slot sizes
- Clear/default conditions
- Very hot temperatures
- Very cold temperatures
- Fahrenheit and Celsius through `iCUE.defaultTemperatureUnit()`
- Rain
- Snow
- Night
- Sunrise and sunset markers in the visible timeline
- Cached stale state
- Preview mode
- Long location names
- Touch hour detail open/close
- Slow provider response while retaining loading state
- Provider failure after a successful cached forecast
- Provider failure with no cache
- Location changes and provider refetch
- Runtime console/page errors and document overflow

Expected Lite case count: 24.

Release gate remains the normal RatPack XENEON gate: deterministic browser QA, all-eight capture, official CORSAIR validate/package on Windows, then StreamSpell packaged verification.
