# ADR-002: Assessment immutability and re-evaluation

## Status

Accepted

## Context

Point-in-time reports must never silently change. Control definitions and framework mappings evolve. Manual review dispositions must be preserved without mutating technical results.

## Decision

1. Each assessment **run** stores an immutable **manifest** (control IDs + versions, framework pack versions, engine version, target fingerprint, capability set).
2. **Control executions** are append-only. Technical result fields are frozen on completion.
3. **Manual dispositions**, exceptions, and risk acceptances are separate versioned rows linked to the execution.
4. **Report snapshots** capture a cryptographic SHA-256 digest over canonical JSON of results + evidence summaries + manifest.
5. Re-running evaluators against stored evidence is allowed for tests and research; production UI always shows the frozen snapshot.
6. Human review that alters a presented result creates a **new report snapshot**, never mutates the previous digest.

## Consequences

- Historical reports remain comparable after control upgrades.
- Storage grows with every run; retention policies apply.
- Comparison engine must distinguish target change vs control-definition change.
