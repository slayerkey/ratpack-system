# Desk Notes Pro validation

## Verdict
BUILD at $5.99.

## Paid value
Pro earns its price through repeated-use organization rather than artificial Lite restrictions: four boards, sixteen single-line entry fields per board, note-card grouping, categories, pins, completed history, rotation, layout modes, and additional themes.

## Text-entry design
Official iCUE `textfield` controls are single-line. Pro therefore groups each board into its own iCUE settings section with sixteen independent Entry fields instead of pretending multiline editing is supported.

Special prefixes are optional and intentionally compact:
- `[ ] Task` creates a touch checklist item
- `! [ ] Task` pins it to the top of its card
- an empty Entry starts a new note card
- `## Heading` labels a note card
- `# Category` adds a category badge

## Deliberate V1 exclusions
Import/export is not included because the current official widget controls do not expose a clean first-party text-file import/export workflow. No unsupported clipboard or keyboard capture is introduced merely to check a feature box.

## Architecture
Both variants use the exact same `desk-notes-core.js` and `desk-notes.css`. Product HTML only declares variant-specific iCUE settings and enables features through `DeskNotesConfig`.
