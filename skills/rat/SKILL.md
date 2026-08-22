---
name: rat
description: Route RatPack product work using canonical registry state and product type.
---

# Rat Router

Read `RATPACK.md`, the product registry, and `standards/product-state.md`.

If no product is supplied, show the active roster with workflow state, blockers, and the next canonical skill.

For a new idea, route to `rat-validate`.

For an existing product, dispatch using `workflow_state`, legacy status mapping, and product type.

Never skip required QA for a paid product. Never treat conversation memory as product state when the registry can answer.

Build dispatch must be product type aware. Profiles, plugins, widgets, and icon packs do not share one implementation path.
