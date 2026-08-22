# Architecture Standard

## Canonical knowledge

Workflow logic lives in `skills/`.

Platform facts and build contracts live in `platforms/`.

Brand and lifecycle constraints live in `standards/`.

Machine readable shared contracts live in `schemas/`.

Adapters contain routing only.

## Dependency rule

A canonical script may depend on another repository only through an explicit versioned interface. Hidden sibling imports and absolute workstation paths are migration defects.

## Clean environment rule

Every automated workflow should have a clean environment acceptance test.

A workflow that succeeds only because of a global package, system font, local checkout, editor extension, or cached browser state must either declare that boundary explicitly or be fixed.

## Artifact rule

CI should emit machine readable QA plus the human downloadable release candidate when possible.

Physical tests should find hardware specific defects, not basic packaging failures.
