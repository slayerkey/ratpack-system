# Desk Notes Pro QA

Automated acceptance targets:
- four touch-switchable boards
- sixteen official single-line Entry fields per board
- blank Entry starts a separate note card
- `##` creates a card heading
- `#` creates a category
- `!` pins an item and pinned items sort first
- completed item history is stored locally
- active board is stored locally
- optional rotation uses the configured interval and pauses after manual board selection
- compact slots show an explicit remaining-item count instead of overflowing
- max-note S-H fixture shows 8 visible + 8 more
- all eight XENEON sizes render without page overflow
- long text ellipsizes safely through shared styles
- cards, columns, and list arrangements remain bounded
- settings fixture applies arrangement/theme changes through `onDataUpdated`
- preview mode works without device-only assumptions
- no network, account, API key, or helper dependency

Physical hardware smoke if available:
1. Switch all four board tabs by touch.
2. Complete and reopen several items, restart iCUE, and confirm state persists.
3. Open Completed History and verify touch target accuracy.
4. Enable board rotation, manually switch a board, and confirm rotation pauses for one minute before resuming.
5. Test S-H/S-V with 16 populated Entry fields and confirm the +MORE state remains readable.
