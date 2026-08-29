# XENEON real iCUE preliminary test — 2026-08-28

This document records hands-on iCUE observations from August 28, 2026. These observations override earlier browser, StreamSpell, lexical-binding, and Corsair Labs compatibility-runner evidence whenever they conflict.

A compatibility test passing does not restore `qa_passed` after a real iCUE failure. The affected behavior must be repaired, covered by a regression, and then retested in real iCUE.

## PC Power Meter

Observed in real iCUE:

- no power sensors were exposed to the widget on the test PC
- selecting other sensor types did not produce readings
- Custom Style did not respond
- individual color controls did not respond
- no further functional telemetry testing was possible without an exposed power sensor

Interpretation:

- non-power sensors must remain rejected by design; the product must never treat temperature, fan, utilization, or another unrelated sensor as watts
- absence of a power sensor on one PC is a legitimate hardware/provider state, not permission to manufacture a reading
- Custom Style failure is independent and must be fixed even when no compatible power sensor exists
- the runtime previously started sensor discovery before explicitly honoring the Sensors plugin initialization lifecycle and some settings paths still depended on `globalThis` properties instead of the document-level iCUE bindings

Recovery work on branch `recovery/xeneon-real-icue-prelim-20260828`:

- explicit `pluginSensorsdataproviderEvents.onInitialized` lifecycle support
- direct-binding-to-legacy-runtime synchronization for meter settings
- `sensor-screen` dashboard capability declaration
- exact-package delayed Sensors plugin initialization regression
- exact-package Custom Style regression

Manual gate still required: retest the fresh package in real iCUE. If the test PC genuinely exposes no power sensors, telemetry cannot be validated there; Custom Style and the no-sensor state can still be validated.

## Desk Notes Lite and Pro

Observed in real iCUE:

- note text fields update the widget
- board behavior settings do not respond correctly
- layout settings do not respond correctly
- Custom Style took roughly one minute before responding

Interpretation:

The mixed result is important. iCUE clearly delivers some control values, but the runtime previously read most values through `globalThis[name]`. Real iCUE can expose controls as document-level JavaScript bindings without guaranteeing the same legacy window-property behavior. This explains why text controls could appear functional while theme, layout, board behavior, and style updates lagged or failed.

Recovery work:

- generated late-binding synchronizer for legacy Desk Notes reads
- synchronizer watches real iCUE binding values and invokes the normal `onDataUpdated` path immediately after a change
- expanded exact-package Desk Notes regression now covers content, theme, font scale, transparency, Pro arrangement, board rotation settings, and history visibility
- the regression intentionally changes lexical bindings without manually calling `onDataUpdated`; the package must react automatically within three seconds

UX follow-up, not part of this rejection repair:

Desk Notes currently depends too heavily on reopening iCUE to type notes. A touch-first quick-add affordance is desirable: a small `+` button on the widget that opens an in-widget text-entry surface if the real XENEON/iCUE host proves that text input is reliable. Do not ship that interaction until it is tested on the real device/host.

## Weather Timeline Lite and Pro

Observed in real iCUE:

Both packages fail installation with:

`Unsupported or corrupted file. Check the file and try again. Missing required attribute.`

Root cause found in canonical source:

The `temperatureUnits` and `theme` combobox controls used `data-options`. Current iCUE combobox controls require `data-values`.

Recovery work:

- replaced `data-options` with `data-values` in Lite and Pro
- build tooling now rejects combobox/tab-button controls that use `data-options`
- recovery workflow checks the exact packaged HTML for the required attributes after official CORSAIR packaging

Manual gate still required: install both fresh Version 1 packages in real iCUE.

## Work Session Tracker Lite and Pro

Observed in real iCUE:

- Lite is functional
- Pro is functional

Product note:

Pro needs stronger paid differentiation than history plus goal-setting alone. This is a product-value improvement, not a rejection-critical functional repair, so it should be handled in a separate feature pass after the current recovery is stable.

## Shipping status from this test

Do not resubmit the previously generated Desk Notes, Weather Timeline, or PC Power Meter recovery packages based only on emulator evidence.

Fresh packages from the real-iCUE recovery branch must first pass:

1. official CORSAIR validation and packaging
2. exact archive/root-file integrity
3. product-specific binding and behavior regressions
4. Corsair Labs host smoke as secondary compatibility evidence
5. real iCUE retest

Work Session Tracker Lite and Pro are the only products in this preliminary set explicitly observed as functional in real iCUE.
