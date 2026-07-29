# SupaCompliant

<p align="center">
  <img src="docs/assets/supacompliant-hero.jpg" alt="SupaCompliant — shield with lightning bolt, surrounded by lock, database, people, and checklist icons" width="720" />
</p>

<p align="center">
  <strong>Continuous database assurance for Supabase and PostgreSQL.</strong>
</p>

> ## Not affiliated with Supabase
>
> **SupaCompliant is an independent open-source project.**  
> It is **not** affiliated with, endorsed by, sponsored by, or partnered with **Supabase, Inc.**  
> It is **not** an official Supabase product.  
> **Supabase** is a trademark of Supabase, Inc. All rights reserved by their respective owners.  
> Mentions of Supabase refer only to compatible database/platform **targets** that this tool can assess.

SupaCompliant is a collaborative point-in-time security and compliance assessment platform for Supabase and PostgreSQL databases. It connects with **explicitly supplied read-only assessment credentials**, runs **deterministic technical controls**, preserves **immutable assessment evidence**, maps findings to Australian and international frameworks, and presents results in a polished light-themed web application.

> This is **not** a questionnaire GRC product. It assesses real database configuration wherever possible.

## What it does

- Connects to Supabase projects and generic PostgreSQL with a least-privilege `supacompliant_assessor` role
- Runs **50+ technical controls** (identity, RLS, hardening, logging, data protection, resilience, Supabase-specific)
- Distinguishes **pass / fail / warning / manual review / not applicable / not assessed / error / unknown**
- **Never** converts collection errors or missing privileges into a pass
- Stores **immutable run manifests** and **SHA-256 report digests**
- Maps controls to **ISM, Essential Eight, PSPF, NIST CSF 2.0, SP 800-53, SP 800-171, OWASP, CIS, SOC 2, ISO 27001, PCI DSS** with transparent rationales
- Supports comparison, comments, findings, exports (JSON, CSV, SARIF, HTML)

## What it does not do

- Does **not** claim formal certification, IRAP accreditation, or Essential Eight maturity levels from database evidence alone
- Does **not** prove whole-of-organisation compliance from a passing technical check
- Does **not** write to customer databases during assessment
- Does **not** expose database passwords, PATs, or service-role keys to the browser

## 5-minute local demo

```bash
# Prerequisites: Node 20+, pnpm 9+
pnpm install
pnpm --filter @supacompliant/shared build
pnpm --filter @supacompliant/assessment-engine build
pnpm --filter @supacompliant/control-library build
pnpm --filter @supacompliant/framework-mappings build
pnpm --filter @supacompliant/reporting build
pnpm --filter @supacompliant/database build
pnpm --filter @supacompliant/web dev
```

Open [http://localhost:3000](http://localhost:3000) → **Open demo**.

Seeded demo org **Aurora Digital** includes six historical runs, findings, comments, and a deliberate regression.

### Run unit tests

```bash
pnpm test
```

### CLI assess against a local Postgres (optional)

```bash
export SUPACOMPLIANT_DATABASE_URL='postgres://supacompliant_assessor:***@127.0.0.1:5432/postgres'
export SUPACOMPLIANT_ALLOW_PRIVATE=1
pnpm --filter @supacompliant/cli exec tsx src/index.ts connection test
pnpm --filter @supacompliant/cli exec tsx src/index.ts assess --output sarif --fail-on critical
```

Passwords are never printed.

## Architecture

```
apps/web          Next.js App Router UI + API
apps/worker       PostgreSQL job queue runner
apps/cli          supacompliant CLI
packages/*        shared, engine, controls, frameworks, reporting, database
supabase/         app DB migrations + RLS
```

See [docs/architecture/overview.md](docs/architecture/overview.md) and ADRs under [docs/adr/](docs/adr/).

## Security model (summary)

| Control | Approach |
|---------|----------|
| Multi-tenant isolation | PostgreSQL RLS (forced) on all tenant tables |
| Connection secrets | Envelope encryption (AES-256-GCM + KEK) |
| Assessment SQL | `BEGIN READ ONLY`, statement timeouts, hostile-target assumptions |
| SSRF | Private IP blocking unless explicit local diagnostic mode |
| Report integrity | Immutable executions + SHA-256 digest |
| AuthZ | Server-side roles + RLS (not UI-only) |

Full threat model: [docs/security/threat-model.md](docs/security/threat-model.md).

Assessor role SQL: [docs/guides/assessor-role.sql](docs/guides/assessor-role.sql).

## Framework packs

Australian focus:

- **ISM** — privileged access, auth, logging, backups, patching, crypto, change management
- **Essential Eight** — database-adjacent contribution only; **no fabricated maturity levels**
- **PSPF** — limited INFOSEC-relevant mappings

Also: NIST CSF 2.0, SP 800-53, SP 800-171, OWASP ASVS / Top 10 / API Top 10, CIS PostgreSQL, CIS Controls v8, SOC 2, ISO 27001:2022 Annex A, PCI DSS (DB-related).

Mappings are **versioned** and include relationship + rationale + source URL. They **do not** imply certification.

## Monorepo layout

```
apps/web
apps/worker
apps/cli
packages/shared
packages/database
packages/assessment-engine
packages/control-library
packages/framework-mappings
packages/reporting
packages/ui
packages/config
supabase/migrations
docs/
examples/vulnerable-supabase
```

## Docker Compose

```bash
docker compose up --build
```

See `docker-compose.yml`. Use remote Docker context if configured; Compose still defines local services for contributors.

## CI

GitHub Actions runs lint, typecheck, unit tests, and RLS coverage check on push/PR.

## Contributing

See [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md). Control authoring: [docs/guides/control-authoring.md](docs/guides/control-authoring.md).

## Trademark and affiliation

**Not affiliated with Supabase.**

- SupaCompliant is an **independent open-source project** maintained by its contributors.
- It is **not** affiliated with, endorsed by, sponsored by, partnered with, or officially connected to **Supabase, Inc.** in any way.
- It is **not** an official Supabase product, plugin, or partner offering.
- **Supabase** and related marks are trademarks of Supabase, Inc.
- Framework names (ISM, Essential Eight, NIST, OWASP, CIS, SOC 2, ISO, PCI DSS, etc.) remain the property of their respective owners.
- Use of those names is for descriptive compatibility and mapping only and does **not** imply certification, accreditation, or endorsement.

## Licence

Apache-2.0 — see [LICENSE](LICENSE).

UI visual language inspired by [shadcndashboard](https://github.com/shadcndashboard/shadcndashboard) (MIT); product code is original.

---

*Know what changed. Preserve the evidence. Fix what matters.*  
*Database assurance without spreadsheet archaeology.*
