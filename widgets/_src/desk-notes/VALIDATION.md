# Desk Notes Lite validation

## Verdict
BUILD. Desk Notes solves a XENEON-native problem: information that stays visible underneath the monitor while desktop windows cover normal note apps.

## Text-entry feasibility
The current official iCUE control reference defines `textfield` as a **single-line** text input. Desk Notes therefore does not depend on multiline entry, direct XENEON keyboard capture, clipboard interception, or a helper app.

Lite exposes eight separate native iCUE Entry fields. Each field is one note. Prefixing an entry with `[ ]` turns it into a tappable checklist item. `[x]` is also accepted for an initially completed item.

## Persistence
Checklist completion is stored in `localStorage` under the widget's `uniqueId`, matching the official iCUE persistence pattern. Note text itself remains owned by iCUE settings.

## Lite product boundary
Lite remains permanently useful: one board, eight entries, mixed plain/checklist items, touch completion, custom title, six themes, font sizing, local persistence, and all eight XENEON layouts.

## Upgrade boundary
Pro adds repeat-use organization: four boards, sixteen entry fields per board, note-card grouping, headings, categories, pins, history, board rotation, layout modes, and additional themes. Lite does not lose any core reminder workflow.

## Marketplace rule check
Current Marketplace product guidelines explicitly encourage free Lite / paid variants and prohibit external paywalls or third-party payment redirects. The optional Lite upgrade action therefore targets only the future Elgato Marketplace listing through iCUE's official Link Provider.
