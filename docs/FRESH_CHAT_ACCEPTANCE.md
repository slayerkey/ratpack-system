# Fresh Chat Acceptance

Give the agent repository access but no prior RatPack conversation history.

Ask these questions in order:

1. What is RatPack?
2. What products do we build?
3. Where is canonical product state?
4. What is Rat Validate?
5. What does Rat Art do?
6. What are we currently building?
7. What is blocked?
8. What should be built next?
9. Build or improve one approved product without asking for a giant context prompt.
10. Run the appropriate automated tests.
11. Prepare the release candidate as far as the web workflow allows.
12. State the exact final local or hardware checks that remain.

Pass criteria:

* Uses `RATPACK.md` as the entry point.
* Reads the matching canonical skill rather than a tool specific duplicate.
* Uses registry state rather than conversation memory for product state.
* Dispatches build behavior by product type.
* Does not call VSD a simulator.
* Does not silently produce art when required fonts or widget captures are missing.
* Uses GitHub or CI rather than asking the user to run ordinary build commands locally.
* Stops at a genuine hardware, host application, or authenticated submission boundary.
