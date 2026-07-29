# ADR-004: Multi-tenant isolation via RLS

## Status

Accepted

## Context

Organisations must not see each other's data. Hidden UI is not authorisation.

## Decision

1. Every tenant table includes `organisation_id` (or is reachable only through organisation-scoped parent keys).
2. PostgreSQL **RLS is enabled and forced** on all application tables that hold tenant data.
3. JWT claims set via `auth.uid()` and a `current_organisation_id()` helper from membership.
4. Service-role used only by worker for job claims; worker still scopes writes by organisation_id from the job row.
5. CI fails if any application table lacks an explicit RLS policy decision (enabled + policies, or documented exclusion).
6. Cross-tenant isolation tests are mandatory.

## Consequences

- Slight query overhead; acceptable.
- Migrations must ship policies with tables.
- Membership role checks also enforced in API handlers (defence in depth).
