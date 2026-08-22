# RATPACK

## What RatPack is

RatPack is Packrat's product factory and operating system for researching, building, testing, packaging, marketing, shipping, and maintaining marketplace products.

The current factory covers Stream Deck profiles, Stream Deck plugins, Stream Deck icon packs, CORSAIR iCUE widgets for XENEON Edge, and additional marketplace experiments.

## Operating principle

GitHub is the canonical source of truth.

ChatGPT is the preferred development and orchestration environment.

GitHub Actions is the preferred remote build and test computer when a clean or platform specific runner is required.

Local applications and physical hardware are final validation boundaries, not the normal place to discover ordinary code, packaging, or art failures.

## Canonical repository

`ratpack-system` is the hub for shared skills, standards, platform references, workflow contracts, schemas, CI contracts, reusable QA, adapters, product registry, and product source as migration progresses.

During migration, the existing local `ratpack-projects` and `_shared` directories remain compatibility dependencies until their consumers are moved into versioned paths here and the clean environment tests pass.

## Natural task language

When the user says "Rat validate this", follow `skills/rat-validate/SKILL.md`.

When the user says "Build it", follow `skills/rat-build/SKILL.md` and dispatch by product type.

When the user says "Make the art", follow `skills/rat-art/SKILL.md`.

When the user says "Run QA", follow `skills/rat-qa/SKILL.md`.

When the user says "Package it" or "Ship it", follow `skills/rat-ship/SKILL.md`.

When the user asks what is next, follow `skills/rat/SKILL.md` using canonical product state.

## Product types

`profile`: Stream Deck profile products, including standard, XL, Plus, VSD, Windows, and Mac variants when applicable.

`plugin`: Stream Deck SDK plugins.

`widget`: CORSAIR iCUE widgets, including XENEON Edge dashboard LCD products.

`icons`: Stream Deck icon packs.

Other marketplace types may exist. Do not force them through a Stream Deck specific builder.

## Workflow states

IDEA

RESEARCHING

VALIDATED

PLANNED

BUILDING

TESTING

ART

READY_FOR_HARDWARE_QA

READY_TO_SHIP

SUBMITTED

PUBLISHED

BLOCKED

REJECTED

The current product registry may still use a smaller legacy `status` vocabulary. During migration, preserve compatibility while introducing `workflow_state` using `standards/product-state.md`.

## Source of truth rules

Product names, price, status, type, keywords, and required variants come from canonical product metadata.

Validation evidence belongs with the product and must survive a NO GO decision.

Shared workflow logic belongs here, not duplicated across Claude commands and Agent skills.

Claude, Codex, and ChatGPT adapters should be thin. They may route to canonical skills but should not contain a second full copy of the workflow.

Existing published identifiers are immutable. Do not rename published plugin or product identifiers solely to make namespaces consistent.

## Web first execution rule

Stay in ChatGPT until a real technical boundary is reached.

Use direct execution when the tool runs in the ChatGPT environment.

Use GitHub Actions when dependency installation, Windows, a browser, a vendor CLI, or a clean runner is required.

Use the local PC only for host application state, authenticated browser state that cannot be delegated safely, or final hardware validation.

## Final local boundaries currently known

Physical Stream Deck behavior and import validation.

Physical XENEON Edge touch, rendering, and iCUE host validation.

Maker Console authenticated submission under the current Playwright design.

Host application runtime validation for products that integrate with applications such as Premiere Pro, Resolve, or AutoCAD.

## Critical migration blockers

The local `ratpack-projects` and `_shared` content must be preserved before restructuring.

Brand art must fail if its required brand font cannot be resolved. Silent fallback is not acceptable.

XENEON art must require real captured widget shots before rendering. Missing shots must fail the pipeline rather than produce blank marketing art.

Widget shipping support must be implemented explicitly before Maker Console automation is trusted for widgets.

The iCUE Widget CLI Windows CI bootstrap still needs a clean runner proof.

## Read next by task

Validation: `skills/rat-validate/SKILL.md`

Build: `skills/rat-build/SKILL.md` plus the matching file under `platforms/`

Art: `skills/rat-art/SKILL.md`

QA: `skills/rat-qa/SKILL.md`

Ship: `skills/rat-ship/SKILL.md`

XENEON or iCUE work: `skills/icue-widget-builder/SKILL.md` and `platforms/icue-xeneon.md`

Fresh chat acceptance: `docs/FRESH_CHAT_ACCEPTANCE.md`
