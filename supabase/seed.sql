-- SupaCompliant demo seed (Aurora Digital)
-- Load after migrations on a disposable local database.
-- Requires auth.users rows for the three demo members when using live Auth.
-- Digests are clearly labelled demo digests (not cryptographic assessment outputs).

-- Demo organisation
INSERT INTO public.organisations (id, name, slug, require_mfa_privileged)
VALUES (
  'a0000000-0000-4000-8000-000000000001',
  'Aurora Digital (Demo)',
  'aurora-demo',
  false
) ON CONFLICT (id) DO NOTHING;

-- Note: memberships require auth.users UUIDs. Placeholder for service-role seed:
-- INSERT INTO public.memberships (organisation_id, user_id, role) VALUES
--   ('a0000000-0000-4000-8000-000000000001', '<user-uuid>', 'owner');

INSERT INTO public.projects (id, organisation_id, name, slug, description)
VALUES (
  'b0000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000001',
  'Customer Platform',
  'customer-platform',
  'Seeded demo project with development, staging, production environments'
) ON CONFLICT DO NOTHING;

INSERT INTO public.environments (id, organisation_id, project_id, name, kind) VALUES
  ('c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'development', 'development'),
  ('c0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'staging', 'staging'),
  ('c0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'production', 'production')
ON CONFLICT DO NOTHING;

INSERT INTO public.assessment_profiles (id, organisation_id, name, description, framework_packs)
VALUES (
  'd0000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000001',
  'ISM database baseline',
  'Demo profile mapping ISM + Essential Eight contribution',
  '["ism","essential-eight","cis-postgresql"]'::jsonb
) ON CONFLICT DO NOTHING;

-- Six historical runs (demo digests — not live assessment outputs)
INSERT INTO public.assessment_runs (
  id, organisation_id, project_id, environment_id, profile_id, status, digest, progress, completed_at, started_at
) VALUES
  ('e0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'approved', 'demo0001aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 100, '2026-01-05T10:00:00Z', '2026-01-05T09:50:00Z'),
  ('e0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000001', 'approved', 'demo0002aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 100, '2026-01-17T10:00:00Z', '2026-01-17T09:50:00Z'),
  ('e0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000001', 'approved', 'demo0003aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 100, '2026-01-29T10:00:00Z', '2026-01-29T09:50:00Z'),
  ('e0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000001', 'approved', 'demo0004aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 100, '2026-02-10T10:00:00Z', '2026-02-10T09:50:00Z'),
  ('e0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000001', 'approved', 'demo0005aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 100, '2026-02-22T10:00:00Z', '2026-02-22T09:50:00Z'),
  ('e0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000001', 'completed', 'demo0006aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 100, '2026-03-06T10:00:00Z', '2026-03-06T09:50:00Z')
ON CONFLICT DO NOTHING;

INSERT INTO public.findings (
  id, organisation_id, project_id, environment_id, source_control_id, title, severity, status, remediation
) VALUES (
  'f0000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000001',
  'b0000000-0000-4000-8000-000000000001',
  'c0000000-0000-4000-8000-000000000003',
  'pg.rls.permissive_true_policies',
  'Unconditional true RLS policy regression',
  'critical',
  'open',
  'Replace USING (true) with tenant predicates'
) ON CONFLICT DO NOTHING;

INSERT INTO public.audit_events (organisation_id, action, resource_type, resource_id, metadata)
VALUES (
  'a0000000-0000-4000-8000-000000000001',
  'demo.seeded',
  'organisation',
  'a0000000-0000-4000-8000-000000000001',
  '{"source":"supabase/seed.sql","note":"demo digests are labelled, not live assessment outputs"}'::jsonb
);
