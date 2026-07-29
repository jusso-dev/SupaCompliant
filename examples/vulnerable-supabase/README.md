# Vulnerable Supabase sample schema

**Not production-ready.** Intentional security defects for demo and control validation.

## Defects included

| Issue | Control signal |
|-------|----------------|
| Tables without RLS | `pg.rls.tables_without_rls` |
| Policy `USING (true)` | `pg.rls.permissive_true_policies` |
| SECURITY DEFINER without `search_path` | `pg.rls.security_definer_functions` |
| Public storage bucket pattern | `pg.data.storage_buckets_public` |
| Vector table without RLS | `sb.vector_tenant_rls` |
| Broad grants | `sb.public_schema.api_exposure` |

## Files

- `001_vulnerable.sql` — broken baseline
- `002_remediated.sql` — example fixes (partial)

Apply only to disposable local databases.
