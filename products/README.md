# Products

`products/index.json` is the first migrated Packrat roster snapshot from the 2026-08-22 local factory export.

It intentionally contains the fields a fresh agent needs to orient itself quickly: product id, name, type, legacy status, price, and version.

The original local registry contains richer notes, paths, marketplace metadata, keywords, variants, and risk flags. Those fields will be migrated as individual product trees are absorbed and verified.

Until the full registry migration is complete:

* use this index for roster discovery and status summaries
* preserve legacy `status` values
* use `standards/product-state.md` when introducing `workflow_state`
* do not infer that missing rich metadata means a product lacks it in the old factory
* do not overwrite product state from conversation memory

Source snapshot: local `ratpack-projects/registry.json` from `ratpack-context-export`, collected 2026-08-22.
