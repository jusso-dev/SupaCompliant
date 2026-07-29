# RLS isolation test plan

## Automated (CI)

1. **Migration coverage** — every table in `TENANT_TABLES` has `ENABLE` + `FORCE` RLS.
2. **Secrets/jobs revoke** — `connection_secrets` and `jobs` revoked from `authenticated`.
3. **Permission matrix** — `@supacompliant/shared` role → permission unit tests.
4. **Cross-tenant model** — pure membership filter tests for attack scenarios.
5. **`pnpm check:rls`** — fails if tenant table missing RLS enablement.

## Integration (local Supabase / CI with Postgres)

When `DATABASE_URL` available:

1. Create two users + two organisations via `create_organisation`.
2. Insert project into org A as user A.
3. As user B (org B only), `SELECT` projects → zero rows for org A.
4. As user B, `INSERT` into org A tables → policy rejection.
5. As authenticated, `SELECT` from `connection_secrets` → permission denied.
6. As authenticated, `SELECT` from `jobs` → permission denied.

## Manual / IRAP evidence

- Export policy list: `\d+` / `pg_policies`
- Screenshot of failed cross-tenant query
- Map to ISM access control evidence

## Fail-closed rule

Missing capability, missing membership, or denied grant must never surface as a passing assessment control.
