# Desk Notes Lite QA

Automated acceptance targets:
- parser handles plain notes, `[ ]` checklist lines, `[x]` initial completion, and stable duplicate IDs
- hard cap of 8 Lite entries
- all eight XENEON captures render without document overflow
- long board title and long entry copy ellipsize safely
- exactly eight entries remain visible in Lite fixtures
- touch completion toggles one item and applies completed styling
- completed items remain in layout and are visually de-emphasized
- empty board shows deliberate settings guidance
- localStorage keys are scoped by `uniqueId`
- settings updates re-render without reload
- preview mode remains functional
- Link Provider is only invoked from the explicit Pro overlay action

Physical iCUE/XENEON smoke if available:
1. Edit title and multiline notes in iCUE settings.
2. Confirm `[ ]` lines become tappable checkboxes.
3. Complete two items, restart iCUE, and verify completion persists.
4. Change note text and verify stale completion state does not transfer to unrelated text.
5. Test touch accuracy at S-H and S-V.
6. Insert the final Desk Notes Pro Marketplace URL and verify View Pro opens the system browser.
