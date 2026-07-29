# Demo seed (Aurora Digital)

## In-memory (default)

The web app ships with `apps/web/src/lib/demo-data.ts` — six runs, findings,
comments, and a deliberate RLS regression. No database required.

## SQL seed (app database)

After applying migrations:

```bash
psql "$DATABASE_URL" -f supabase/migrations/00001_init.sql
psql "$DATABASE_URL" -f supabase/seed.sql
```

Or with Supabase CLI:

```bash
supabase db reset   # applies migrations + seed if configured
```

### Notes

- Digests in seed begin with `demo` — not live SHA-256 assessment digests.
- `memberships` require real `auth.users` UUIDs when live Auth is enabled.
- Never use seed data as production compliance evidence.
