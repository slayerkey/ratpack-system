# PackRat Voice release status — 2026-08-30

This file is the durable handoff for the PackRat Discord voice product family. Read it before changing approval, shipping, identity, or release-state decisions.

## Products

| Product | Type | Price | Version | Canonical state |
| --- | --- | ---: | --- | --- |
| PackRat Voice Bridge | Stream Deck companion plugin | Free | 1.0.0.0 | `READY_TO_SHIP` |
| PackRat Voice Panel | CORSAIR XENEON Edge widget | $7.99 | 1.0.0 | `READY_TO_SHIP` |
| PackRat Voice Deck | Stream Deck plugin | $9.99 | 1.0.0.0 | `BLOCKED` |

## Operator release decision — 2026-08-30

Voice Bridge and Voice Panel were successfully exercised in real-world Windows / Discord / XENEON testing, including an external tester using the packaged integration successfully.

The operator explicitly elected to proceed with Marketplace submission for **Voice Bridge** and **Voice Panel** without treating the previously documented Discord RPC / StreamKit commercial-permission question as a release gate.

Accordingly:

* `products/discord-bridge.json` is `READY_TO_SHIP` with no blocker.
* `products/discord-panel.json` is `READY_TO_SHIP` with no blocker.
* The generic Rat Ship `BLOCKED` guard remains intact for other products.
* `plugins/discord-bridge/DISCORD_APPROVAL.md` remains in the repository as historical / compliance documentation.
* This release-state decision is **not** a claim that Discord separately granted PackRat written RPC or StreamKit commercial approval. It records the operator's explicit decision not to gate these two releases on that unresolved documentation question.
* Do not automatically restore the old Discord approval blocker to Voice Bridge or Voice Panel in a future run unless the operator explicitly reverses this decision or a concrete Marketplace / Discord rejection requires it.

Voice Deck is **not** included in this release-state override. It retains its own `BLOCKED` state and separate real Windows / physical Stream Deck smoke requirement.

## What is complete

### Voice Bridge

* Product source and shipping files are on canonical `main`.
* Final Windows Bridge Status regression smoke is recorded as passing.
* Discord Bridge Release QA run `33325706619`: **PASS**.
* Discord Bridge Marketplace Kit run `33325706650`: **PASS**.
* Official Stream Deck CLI validation and `.streamDeckPlugin` packaging are covered.
* Release bundle checks prohibit Discord client secrets.
* Current release state: `READY_TO_SHIP`.

### Voice Panel

* Product source and packaged widget are on canonical `main`.
* Latest stable-roster / avatar-layout candidate: `f820cc158912f69f7bb353e0789c580fe8651b94`.
* Latest Discord Panel Deep QA run `33348380403`: **PASS**.
* Latest Discord Panel Marketplace Kit run `33348380455`: **PASS**.
* Exact packaged CORSAIR Labs/iCUE host proof passed.
* All eight native XENEON slot presets passed in source and exact packaged form.
* Loaded real-avatar containment and nameplate separation passed all eight sizes.
* Speaking-state changes no longer reorder member slots; the stable-roster regression passed.
* 50-member stress, actual PackRat Voice Bridge integration, reconnect/channel switching, StreamSpell all eight presets, official CORSAIR validation/package, and deterministic Marketplace media all passed.
* Current release state: `READY_TO_SHIP`.

### Voice Deck

* Product source is on canonical `main`.
* Voice Deck Release QA run `33329108034`: **PASS** at candidate `6aaccc6506c1ea6dbfaee98ea560ae6d47d568bb`.
* The product record retains exact automated artifact/package digest evidence.
* Current release state remains `BLOCKED`.
* Do not include Voice Deck in the Bridge + Panel ship command until its separate release state is deliberately resolved.

## Shared release tooling

* `READY_TO_SHIP` is the canonical final local release state.
* `rat ship` and `rat submit` fail closed for canonical `BLOCKED` and legacy `BLOCKED_*` values.
* `rat kit` and `rat stage` remain usable for blocked products.
* The generic guard was **not** disabled to release Bridge / Panel; only those product records were deliberately moved to `READY_TO_SHIP`.
* Rat Ship Marketplace Routing CI validates product workflow states against the canonical schema.

## Discord implementation note

The current implementation uses the proven local Discord Desktop RPC / IPC flow documented in the product sources and approval notes. Historical investigation raised a question about commercial permission for the Discord StreamKit public RPC identity / token path. That question remains documented in:

```text
plugins/discord-bridge/DISCORD_APPROVAL.md
```

For Voice Bridge and Voice Panel, it is informational rather than a current Rat Ship blocker as of the operator decision above.

Do not silently swap the runtime to one of the historical PackRat Discord Application IDs merely because those IDs appear in old probes or documentation. A future identity change should be treated as an implementation change and regression-tested normally.

## Shipping command

Voice Bridge and Voice Panel are now intended to proceed through the normal authenticated Maker Console submission path:

```powershell
rat ship discord-bridge discord-panel
```

Rat Ship will refresh canonical `main` before acting. If the command stops after this state change, treat the new output as the next concrete Marketplace / Maker Console issue rather than restoring the old Discord permission blocker automatically.

Do not add `voice-deck` to this command while `products/voice-deck.json` remains `BLOCKED`.
