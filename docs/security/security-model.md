# Security model

## Principles

1. PostgreSQL is authoritative for tenant isolation (RLS).
2. Secrets never leave the trusted compute plane.
3. Assessments are read-only against targets.
4. Completed reports are immutable and digests are public within the org.
5. Framework mappings do not imply certification.
6. Every privileged action emits an audit event.

## Roles (application)

| Role | Capabilities |
|------|----------------|
| Organisation owner | Full control, billing, destroy org |
| Organisation administrator | Members, settings, connections |
| Assessment lead | Profiles, run assessments, approve reports |
| Assessor | Run assessments, review controls |
| Engineer | View results, remediate findings |
| Reviewer | Comment, approve manual dispositions |
| Read-only viewer | View reports only |

## MFA policy

Organisations may require MFA for privileged roles (owner, admin, assessment lead). Enforced at session establishment via Supabase Auth AAL claims.

## Connection capability levels

| Level | Meaning |
|-------|---------|
| basic_catalogue | `pg_catalog` / information_schema read |
| monitoring | `pg_stat_*` views |
| audit_log | pgAudit / log settings visibility |
| supabase_management | Management API token present |
| manual_evidence | Human attestation only |

Unavailable checks surface as `not_assessed` or `unknown`, never pass.

## Encryption

- At rest: envelope encryption for secrets; Supabase/Postgres storage encryption for platform data
- In transit: TLS to app DB and targets (prefer `verify-full`)
- Report digests: SHA-256 over canonical JSON

## Disclosure

See [SECURITY.md](../../SECURITY.md).
