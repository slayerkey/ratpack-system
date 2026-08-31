# Rat Audit

`rat audit <slug>` runs a product's real-host diagnostic against the exact local source that Rat Dev activated for physical testing.

## Normal flow

```text
rat dev voice-deck
rat audit voice-deck
```

Rat Audit prints the source kind, source commit, source branch, product root, active plugin path when available, and exact audit script before executing the product's `scripts/host-audit.ps1`.

For internal RatPack products it resolves the product from `out\dev\worktrees\<slug>`. For registered external Stream Deck plugins it follows the successful deployment identity in `out\dev\state\<slug>.json` and audits the isolated validated build that is actually linked into Stream Deck, not the controller checkout.

The command is intentionally separate from Rat Dev. A development build can be valid even when the physical host dependency is unavailable at that moment, such as Discord Desktop being closed or a device not being connected. Rat Audit is the explicit real-host evidence pass.

## Deep probe

Products may optionally expose an npm `host:probe` script for a deeper transport or integration diagnostic:

```text
rat audit voice-deck --probe
```

Rat Audit always runs the normal host audit first. It only runs `host:probe` after that audit succeeds.

## Failure behavior

Rat Audit fails clearly when:

* no Rat Dev source or successful external deployment state exists for the slug
* the recorded active external plugin path no longer exists
* the product does not expose `scripts/host-audit.ps1`
* more than one ambiguous host audit script is found
* the product host audit returns a nonzero exit code
* `--probe` is requested but the product does not expose an npm `host:probe` script
* the deep probe fails

It does not reinstall, delete logs, switch product source, or change the active development build when an audit fails.

For Voice Deck specifically, preserve `HOST_AUDIT_LATEST.txt` and the plugin/Stream Deck logs before changing or uninstalling anything. The canonical physical checklist remains `plugins/voice-deck/REAL_WINDOWS_SMOKE.md`.

## Source freshness and dirty checkouts

`rat audit` is intentionally read-only and does not bootstrap, switch, pull, restore, clean, or otherwise mutate the canonical RatPack checkout before it runs. This allows diagnostics to inspect the already activated Rat Dev build even when an unrelated product has local source changes or generated output in the main checkout.

The audit still prints the exact active source commit and path it is inspecting, so its evidence remains attributable. `rat dev`, `rat kit`, `rat stage`, `rat ship`, and other mutating/release commands keep the normal self-updating clean-checkout protection.

If Rat Audit itself is missing or an operator intentionally needs the newest shared command implementation, clean or preserve the canonical checkout first and run `rat main`, then rerun the audit.
