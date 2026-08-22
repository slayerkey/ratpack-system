# Product State

The current factory has a legacy `status` field used by existing scripts. Do not break it during the first migration.

The target canonical field is `workflow_state`.

| workflow_state | Meaning | Legacy status mapping |
| --- | --- | --- |
| IDEA | captured idea | idea |
| RESEARCHING | validation in progress | idea |
| VALIDATED | approved to plan | validated |
| PLANNED | implementation contract locked | validated |
| BUILDING | implementation in progress | building |
| TESTING | automated verification in progress | built |
| ART | listing assets in progress | built |
| READY_FOR_HARDWARE_QA | automated gates clean | qa_passed |
| READY_TO_SHIP | final local gate complete | qa_passed |
| SUBMITTED | marketplace review in progress | submitted |
| PUBLISHED | live | published |
| BLOCKED | cannot advance until named blocker resolves | preserve previous status plus blocker |
| REJECTED | validation or marketplace rejection that is not in an active fix loop | rejected |

During migration, tools may write both fields. The legacy field remains the compatibility interface until all consumers are updated.
