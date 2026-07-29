-- SupaCompliant read-only assessor role
-- Run as a superuser / privileged admin on the TARGET database.
-- Never use a superuser for routine assessments.

-- 1. Role
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supacompliant_assessor') THEN
    CREATE ROLE supacompliant_assessor NOINHERIT LOGIN;
  END IF;
END$$;

-- Set a strong password out-of-band:
-- ALTER ROLE supacompliant_assessor PASSWORD 'replace-me';

-- 2. Connect
GRANT CONNECT ON DATABASE current_database() TO supacompliant_assessor;

-- 3. Catalogue access (basic capability)
GRANT USAGE ON SCHEMA public TO supacompliant_assessor;
GRANT SELECT ON ALL TABLES IN SCHEMA pg_catalog TO supacompliant_assessor;
GRANT SELECT ON ALL TABLES IN SCHEMA information_schema TO supacompliant_assessor;

-- Future tables in public (optional; prefer explicit grants)
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO supacompliant_assessor;

-- 4. Monitoring (optional — elevates capability to monitoring)
-- GRANT pg_monitor TO supacompliant_assessor;

-- 5. Supabase schemas (read-only metadata)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN
    EXECUTE 'GRANT USAGE ON SCHEMA auth TO supacompliant_assessor';
    EXECUTE 'GRANT SELECT ON ALL TABLES IN SCHEMA auth TO supacompliant_assessor';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'storage') THEN
    EXECUTE 'GRANT USAGE ON SCHEMA storage TO supacompliant_assessor';
    EXECUTE 'GRANT SELECT ON ALL TABLES IN SCHEMA storage TO supacompliant_assessor';
  END IF;
END$$;

-- 6. Explicitly deny dangerous privileges
-- (assessor must never own objects or write data)
REVOKE CREATE ON SCHEMA public FROM supacompliant_assessor;
ALTER ROLE supacompliant_assessor NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;

-- Notes:
-- - Assessments set SESSION / transaction READ ONLY.
-- - Prefer network ACLs limiting assessor connections to SupaCompliant workers.
-- - Rotate password regularly; prefer ephemeral credentials for CI.
