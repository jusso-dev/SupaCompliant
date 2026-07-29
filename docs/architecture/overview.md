# Architecture overview

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  apps/web   │────▶│  App PostgreSQL  │◀────│  apps/worker    │
│  Next.js    │     │  + RLS + jobs    │     │  assessment     │
│  BFF/API    │     │  + Storage meta  │     │  engine         │
└─────────────┘     └──────────────────┘     └────────┬────────┘
       │                      │                        │
       │                      │                        ▼
       │                      │              ┌─────────────────┐
       │                      │              │ Target Postgres │
       │                      │              │ or Supabase     │
       │                      │              │ (read-only role)│
       ▼                      ▼              └─────────────────┘
  Browser (no secrets)   Encrypted secrets
```

## Trust boundaries

1. **Browser** — session cookies only; no DB passwords, PATs, or service keys.
2. **Web BFF** — authn/authz, preflight orchestration, never logs secrets.
3. **App database** — multi-tenant source of truth; RLS enforced.
4. **Worker** — decrypts secrets, connects to targets as hostile networks, runs controls, writes immutable results.
5. **Target database** — treated as untrusted; read-only transactions only.

## Data flow (assessment)

1. User configures connection → secrets envelope-encrypted → stored (or ephemeral).
2. Preflight tests connectivity, version, extensions, capabilities.
3. User starts assessment → job row inserted (`queued`).
4. Worker claims job (`SKIP LOCKED`), builds immutable manifest.
5. For each control: collect → evaluate → store execution + evidence.
6. Digest computed; snapshot frozen; webhooks fired; notifications created.

## Key packages

- `@supacompliant/shared` — enums and Zod
- `@supacompliant/assessment-engine` — orchestration
- `@supacompliant/control-library` — ≥50 technical controls
- `@supacompliant/framework-mappings` — ISM, E8, NIST, OWASP, CIS, SOC2, ISO, PCI
- `@supacompliant/reporting` — compare + export

## Non-goals

- Whole-of-organisation GRC questionnaires
- Formal certification or accreditation claims
- Writing changes to customer databases during assessment
