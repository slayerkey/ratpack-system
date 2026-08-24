# Desk Notes Lite QA

Automated acceptance targets:
- official single-line iCUE `textfield` controls for board title and all 8 entries
- parser handles plain notes, `[ ]` checklist items, `[x]` initial completion, and stable duplicate IDs
- hard cap of 8 Lite entry fields
- empty board renders deliberate guidance instead of fallback content
- all eight XENEON captures render without document overflow
- long board title and long note copy exercise safe ellipsis/clipping
- maximum-note fixture keeps all 8 Lite entries visible
- touch completion toggles one item without removing it
- reload fixture proves completion survives a widget reload
- settings fixture proves theme/font/accent updates apply through `onDataUpdated`
- preview-mode fixture remains functional
- Link Provider is invoked only from the explicit Pro discovery action
- localStorage keys are scoped by `uniqueId`

Physical iCUE/XENEON smoke if available:
1. Edit title and each Entry field in iCUE settings.
2. Confirm `[ ]` entries become tappable checkboxes.
3. Complete two items, restart iCUE, and verify completion persists.
4. Change note text and verify stale completion state does not transfer to unrelated text.
5. Test touch accuracy at S-H and S-V.
6. Insert the final Desk Notes Pro Marketplace URL and verify View Pro opens the normal browser.
