# PackRat Voice release status — 2026-08-30

This file is the durable handoff for the PackRat Discord voice product family. Read it before reopening approval, shipping, or identity work.

## Products

| Product | Type | Price | Version | Canonical state |
| --- | --- | ---: | --- | --- |
| PackRat Voice Bridge | Stream Deck companion plugin | Free | 1.0.0.0 | `BLOCKED` |
| PackRat Voice Panel | CORSAIR XENEON Edge widget | $7.99 | 1.0.0 | `BLOCKED` |
| PackRat Voice Deck | Stream Deck plugin | $9.99 | 1.0.0.0 | `BLOCKED` |

Bridge and Panel are technically release-ready. Voice Deck has green automated release QA but still has its named real Windows / physical Stream Deck packaged-plugin smoke in addition to the Discord approval boundary.

## What is complete

### Voice Bridge

* Product source and shipping files are on canonical `main`.
* Final user-reported Windows Bridge Status regression smoke is recorded as passing.
* Discord Bridge Release QA run `33325706619`: **PASS**.
* Discord Bridge Marketplace Kit run `33325706650`: **PASS**.
* Official Stream Deck CLI validation and `.streamDeckPlugin` packaging are covered.
* Release bundle checks prohibit Discord client secrets.

### Voice Panel

* Product source and packaged widget are on canonical `main`.
* Discord Panel Deep QA run `33325732969`: **PASS**.
* Discord Panel Marketplace Kit run `33325732974`: **PASS**.
* Exact packaged CORSAIR Labs/iCUE host proof covers `onICUEInitialized`, `onDataUpdated`, property bindings, styling, and no page/console errors.
* All eight native XENEON slot presets, stress cases, actual local companion integration, reconnect/channel-switch behavior, StreamSpell, official CORSAIR validation/package, and deterministic Marketplace media are covered.

### Voice Deck

* Product source is on canonical `main`.
* Voice Deck Release QA run `33329108034`: **PASS** at candidate `6aaccc6506c1ea6dbfaee98ea560ae6d47d568bb`.
* The product record retains exact automated artifact/package digest evidence.
* Remaining non-Discord release work: real Windows Discord / physical Stream Deck packaged-plugin smoke.

### Shared release tooling

* Canonical workflow state is schema-defined `BLOCKED`, not the old ad-hoc `BLOCKED_EXTERNAL_APPROVAL` value.
* Every blocked Voice product has an explicit `blocker` field.
* `rat ship` and `rat submit` fail closed for canonical `BLOCKED` and legacy `BLOCKED_*` values.
* `rat kit` and `rat stage` remain available while blocked.
* Rat Ship tells the operator to resolve the blocker and move the product to `READY_TO_SHIP`.
* Rat Ship Marketplace Routing CI validates the guard behavior and all product records that expose `workflow_state` against the canonical schema.
* Routing regression run `33345351142`: **PASS**.
* Lightweight canonical-context CI after the approval documentation hardening remains green; run `33345568210`: **PASS**.

## Current Discord production boundary

Required Discord scopes:

```text
rpc
rpc.voice.read
rpc.voice.write
```

Discord's current OAuth documentation marks all three as approved-partner-only. Discord's RPC documentation says unapproved applications are limited to testers during development. Discord's Developer Terms say an assigned Application ID is for the application it belongs to and must not be enabled for another application.

The technically proven development path uses Discord StreamKit's public RPC identity and public token exchange endpoint. This proves feasibility only. It is not treated as commercial permission for PackRat.

Public release requires one of these explicit written outcomes:

1. Discord approves a PackRat-owned application for `rpc`, `rpc.voice.read`, and `rpc.voice.write` and defines the acceptable production authorization/token exchange path; or
2. Discord explicitly authorizes PackRat's third-party commercial Voice products to use the StreamKit application identity and token endpoint.

Anything less keeps the Voice products `BLOCKED`.

Canonical policy and the submission-ready request are in:

```text
plugins/discord-bridge/DISCORD_APPROVAL.md
```

## Production application identity

Historical PackRat-owned IDs are context, not an automatic choice:

```text
1540927508302536724
Old proof-of-concept application.

1539767359596662875
Later PackRat application used during an abandoned browser OAuth experiment.
```

Do not silently switch the runtime to either ID and do not file approval under one merely because it appeared in an old probe.

Before filing, inspect the current Discord Developer Portal and deliberately select or create the durable PackRat Voice application. If neither historical app was intentionally meant to represent this product family long term, a clean PackRat Voice application is preferable to repurposing a proof-of-concept identity with stale OAuth configuration.

Record the selected application ID/name in `plugins/discord-bridge/DISCORD_APPROVAL.md` and use exactly that identity in the request.

## Manual boundary

Only two approval actions cannot be completed from repository automation:

1. In the authenticated Discord Developer Portal, choose/create the production PackRat Voice application and capture its Application ID + name.
2. Sign into the Discord Developer Support portal and submit the prepared request from `plugins/discord-bridge/DISCORD_APPROVAL.md`.

The support form itself requires sign-in. Do not route this through Discord's game/Social-SDK business-development form just to avoid login; that form does not describe this hardware RPC integration accurately.

## After Discord responds

Do not implement from a generic acknowledgement. Read the actual written response and determine which production path Discord approved.

If PackRat-owned RPC access is approved:

1. Use the approved PackRat Application ID.
2. Implement only Discord's approved production authorization/token exchange architecture.
3. Never embed a Discord Client Secret in a Stream Deck plugin or XENEON widget.
4. If a confidential exchange is required, keep the secret in minimal PackRat-controlled server infrastructure; only the resulting session token may reach the local process.
5. Keep Voice Panel credential-free and localhost-only behind Voice Bridge.
6. Rerun the real Windows Voice Deck smoke, Bridge Release QA, and Panel Deep QA as required by the approved identity/token change.
7. Retain the Discord ticket identifier, written approval, granted scopes, app ID/name, date, and production requirements in release documentation.
8. Move only products whose complete blockers are resolved to `READY_TO_SHIP`.

If Discord explicitly approves StreamKit reuse, retain that written permission and rerun the required release regressions without changing identity unnecessarily.

## Shipping commands

While Discord approval is unresolved, public shipping should fail closed. Non-public preparation remains available:

```powershell
rat kit discord-bridge discord-panel
rat stage discord-bridge discord-panel
```

After Discord approval is documented and Bridge + Panel are moved to `READY_TO_SHIP`:

```powershell
rat ship discord-bridge discord-panel
```

Do not add `voice-deck` to that command until its separate real Windows / physical Stream Deck packaged-plugin smoke is also complete and its product record is `READY_TO_SHIP`.
