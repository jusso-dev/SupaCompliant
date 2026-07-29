# ADR-005: Plugin control SDK with separable collect/evaluate

## Status

Accepted

## Context

Controls must be deterministic, testable without a live database, and versioned for historical runs.

## Decision

Each technical control implements:

```ts
collect(context) → input
evaluate(input) → ControlEvaluation
```

- Collectors run against hostile targets under `SET TRANSACTION READ ONLY`, statement timeouts, and no dynamic identifier concatenation from untrusted data.
- Evaluators are pure functions over structured input + fixtures.
- Result statuses: `pass | fail | warning | manual_review | not_applicable | not_assessed | error | unknown`.
- Collection failure → `error` or `unknown`, never `pass`.
- Insufficient privilege → `unknown` or `not_assessed` with capability gap recorded.

## Consequences

- Unit tests cover every evaluator with fixtures.
- Engine can re-evaluate captured evidence in CI.
