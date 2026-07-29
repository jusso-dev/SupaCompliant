-- SupaCompliant application schema
-- Multi-tenant isolation via forced RLS

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_org_member(org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.organisation_id = org_id
      AND m.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.org_role(org_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.role FROM public.memberships m
  WHERE m.organisation_id = org_id
    AND m.user_id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.has_org_role(org_id uuid, allowed text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.organisation_id = org_id
      AND m.user_id = auth.uid()
      AND m.role = ANY (allowed)
  );
$$;

-- ---------------------------------------------------------------------------
-- Core tables
-- ---------------------------------------------------------------------------

CREATE TABLE public.organisations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  require_mfa_privileged boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN (
    'owner','administrator','assessment_lead','assessor','engineer','reviewer','viewer'
  )),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organisation_id, user_id)
);

CREATE TABLE public.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL,
  token_hash text NOT NULL,
  invited_by uuid REFERENCES auth.users(id),
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organisation_id, slug)
);

CREATE TABLE public.environments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'development'
    CHECK (kind IN ('development','staging','production','other')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.database_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  environment_id uuid NOT NULL REFERENCES public.environments(id) ON DELETE CASCADE,
  name text NOT NULL,
  target_type text NOT NULL CHECK (target_type IN ('supabase','postgresql')),
  host text,
  port integer,
  database_name text,
  username text,
  ssl_mode text DEFAULT 'require',
  project_ref text,
  persist_secrets boolean NOT NULL DEFAULT true,
  last_preflight jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Secrets never exposed to browser clients (no SELECT for authenticated)
CREATE TABLE public.connection_secrets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL UNIQUE REFERENCES public.database_connections(id) ON DELETE CASCADE,
  ciphertext text NOT NULL,
  nonce text NOT NULL,
  wrapped_dek text NOT NULL,
  kek_version text NOT NULL DEFAULT 'v1',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.assessment_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  framework_packs jsonb NOT NULL DEFAULT '[]'::jsonb,
  control_ids jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.assessment_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  environment_id uuid NOT NULL REFERENCES public.environments(id) ON DELETE CASCADE,
  connection_id uuid REFERENCES public.database_connections(id),
  profile_id uuid REFERENCES public.assessment_profiles(id),
  status text NOT NULL DEFAULT 'draft',
  manifest jsonb,
  digest text,
  progress integer NOT NULL DEFAULT 0,
  error_message text,
  created_by uuid REFERENCES auth.users(id),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX assessment_runs_org_idx ON public.assessment_runs(organisation_id);

CREATE TABLE public.control_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  run_id uuid NOT NULL REFERENCES public.assessment_runs(id) ON DELETE CASCADE,
  control_id text NOT NULL,
  control_version text NOT NULL,
  status text NOT NULL,
  severity text NOT NULL,
  summary text NOT NULL,
  expected text,
  actual text,
  evidence jsonb,
  evidence_summary text,
  duration_ms integer,
  categories jsonb,
  mappings jsonb,
  remediation jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Immutability: no updates once inserted (enforced by trigger)
  CONSTRAINT control_executions_status_check CHECK (status IN (
    'pass','fail','warning','manual_review','not_applicable','not_assessed','error','unknown'
  ))
);

CREATE INDEX control_executions_run_idx ON public.control_executions(run_id);

CREATE OR REPLACE FUNCTION public.prevent_execution_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'control_executions are immutable';
END;
$$;

CREATE TRIGGER control_executions_no_update
  BEFORE UPDATE OR DELETE ON public.control_executions
  FOR EACH ROW EXECUTE FUNCTION public.prevent_execution_mutation();

CREATE TABLE public.report_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  run_id uuid NOT NULL REFERENCES public.assessment_runs(id) ON DELETE CASCADE,
  digest text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  environment_id uuid REFERENCES public.environments(id),
  source_control_id text,
  source_execution_id uuid,
  title text NOT NULL,
  description text,
  severity text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  owner_id uuid REFERENCES auth.users(id),
  first_observed_at timestamptz NOT NULL DEFAULT now(),
  last_observed_at timestamptz NOT NULL DEFAULT now(),
  due_at timestamptz,
  remediation text,
  external_ticket_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.comment_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  run_id uuid REFERENCES public.assessment_runs(id) ON DELETE CASCADE,
  execution_id uuid REFERENCES public.control_executions(id) ON DELETE CASCADE,
  finding_id uuid REFERENCES public.findings(id) ON DELETE CASCADE,
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  thread_id uuid NOT NULL REFERENCES public.comment_threads(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id),
  body_markdown text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  edited_at timestamptz
);

CREATE TABLE public.audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid REFERENCES public.organisations(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id),
  action text NOT NULL,
  resource_type text,
  resource_id text,
  metadata jsonb DEFAULT '{}'::jsonb,
  ip inet,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_events_org_idx ON public.audit_events(organisation_id);

CREATE TABLE public.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  job_type text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','running','completed','failed','cancelled')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  ephemeral_secrets jsonb,
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  run_after timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  locked_by text,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX jobs_pending_idx ON public.jobs(status, run_after);

CREATE TABLE public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  name text NOT NULL,
  key_prefix text NOT NULL,
  key_hash text NOT NULL,
  scopes jsonb NOT NULL DEFAULT '[]'::jsonb,
  expires_at timestamptz,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  url text NOT NULL,
  secret_hash text NOT NULL,
  events jsonb NOT NULL DEFAULT '[]'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  href text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  execution_id uuid REFERENCES public.control_executions(id),
  finding_id uuid REFERENCES public.findings(id),
  reason text NOT NULL,
  approved_by uuid REFERENCES auth.users(id),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.risk_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  finding_id uuid NOT NULL REFERENCES public.findings(id) ON DELETE CASCADE,
  rationale text NOT NULL,
  accepted_by uuid REFERENCES auth.users(id),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.organisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organisations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects FORCE ROW LEVEL SECURITY;
ALTER TABLE public.environments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.environments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.database_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.database_connections FORCE ROW LEVEL SECURITY;
ALTER TABLE public.connection_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connection_secrets FORCE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_runs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.control_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.control_executions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.report_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_snapshots FORCE ROW LEVEL SECURITY;
ALTER TABLE public.findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.findings FORCE ROW LEVEL SECURITY;
ALTER TABLE public.comment_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_threads FORCE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events FORCE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys FORCE ROW LEVEL SECURITY;
ALTER TABLE public.webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhooks FORCE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications FORCE ROW LEVEL SECURITY;
ALTER TABLE public.exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exceptions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.risk_acceptances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_acceptances FORCE ROW LEVEL SECURITY;

-- Organisations: members can select; insert via security definer RPC preferred
CREATE POLICY organisations_select ON public.organisations
  FOR SELECT USING (public.is_org_member(id));
CREATE POLICY organisations_update ON public.organisations
  FOR UPDATE USING (public.has_org_role(id, ARRAY['owner','administrator']));

CREATE POLICY memberships_select ON public.memberships
  FOR SELECT USING (public.is_org_member(organisation_id));
CREATE POLICY memberships_insert ON public.memberships
  FOR INSERT WITH CHECK (public.has_org_role(organisation_id, ARRAY['owner','administrator']));
CREATE POLICY memberships_update ON public.memberships
  FOR UPDATE USING (public.has_org_role(organisation_id, ARRAY['owner','administrator']));
CREATE POLICY memberships_delete ON public.memberships
  FOR DELETE USING (public.has_org_role(organisation_id, ARRAY['owner','administrator']));

CREATE POLICY invitations_all ON public.invitations
  FOR ALL USING (public.has_org_role(organisation_id, ARRAY['owner','administrator']))
  WITH CHECK (public.has_org_role(organisation_id, ARRAY['owner','administrator']));

CREATE POLICY projects_select ON public.projects
  FOR SELECT USING (public.is_org_member(organisation_id));
CREATE POLICY projects_write ON public.projects
  FOR ALL USING (public.has_org_role(organisation_id, ARRAY['owner','administrator','assessment_lead']))
  WITH CHECK (public.has_org_role(organisation_id, ARRAY['owner','administrator','assessment_lead']));

CREATE POLICY environments_select ON public.environments
  FOR SELECT USING (public.is_org_member(organisation_id));
CREATE POLICY environments_write ON public.environments
  FOR ALL USING (public.has_org_role(organisation_id, ARRAY['owner','administrator','assessment_lead']))
  WITH CHECK (public.has_org_role(organisation_id, ARRAY['owner','administrator','assessment_lead']));

CREATE POLICY connections_select ON public.database_connections
  FOR SELECT USING (public.is_org_member(organisation_id));
CREATE POLICY connections_write ON public.database_connections
  FOR ALL USING (public.has_org_role(organisation_id, ARRAY['owner','administrator','assessment_lead','assessor']))
  WITH CHECK (public.has_org_role(organisation_id, ARRAY['owner','administrator','assessment_lead','assessor']));

-- No SELECT policy for authenticated on connection_secrets (service role / worker only)
-- Explicit deny via enable RLS + no policy for authenticated

CREATE POLICY profiles_select ON public.assessment_profiles
  FOR SELECT USING (public.is_org_member(organisation_id));
CREATE POLICY profiles_write ON public.assessment_profiles
  FOR ALL USING (public.has_org_role(organisation_id, ARRAY['owner','administrator','assessment_lead']))
  WITH CHECK (public.has_org_role(organisation_id, ARRAY['owner','administrator','assessment_lead']));

CREATE POLICY runs_select ON public.assessment_runs
  FOR SELECT USING (public.is_org_member(organisation_id));
CREATE POLICY runs_insert ON public.assessment_runs
  FOR INSERT WITH CHECK (public.has_org_role(organisation_id, ARRAY['owner','administrator','assessment_lead','assessor']));
CREATE POLICY runs_update ON public.assessment_runs
  FOR UPDATE USING (public.has_org_role(organisation_id, ARRAY['owner','administrator','assessment_lead','assessor','reviewer']));

CREATE POLICY executions_select ON public.control_executions
  FOR SELECT USING (public.is_org_member(organisation_id));
-- Inserts performed by service role worker

CREATE POLICY snapshots_select ON public.report_snapshots
  FOR SELECT USING (public.is_org_member(organisation_id));

CREATE POLICY findings_select ON public.findings
  FOR SELECT USING (public.is_org_member(organisation_id));
CREATE POLICY findings_write ON public.findings
  FOR ALL USING (public.has_org_role(organisation_id, ARRAY['owner','administrator','assessment_lead','assessor','engineer']))
  WITH CHECK (public.has_org_role(organisation_id, ARRAY['owner','administrator','assessment_lead','assessor','engineer']));

CREATE POLICY threads_select ON public.comment_threads
  FOR SELECT USING (public.is_org_member(organisation_id));
CREATE POLICY threads_write ON public.comment_threads
  FOR ALL USING (public.is_org_member(organisation_id))
  WITH CHECK (public.is_org_member(organisation_id));

CREATE POLICY comments_select ON public.comments
  FOR SELECT USING (public.is_org_member(organisation_id));
CREATE POLICY comments_insert ON public.comments
  FOR INSERT WITH CHECK (
    public.is_org_member(organisation_id)
    AND author_id = auth.uid()
  );
CREATE POLICY comments_update ON public.comments
  FOR UPDATE USING (author_id = auth.uid());

CREATE POLICY audit_select ON public.audit_events
  FOR SELECT USING (public.has_org_role(organisation_id, ARRAY['owner','administrator','assessment_lead']));

-- Jobs: no client access (worker uses service role)
-- API keys / webhooks: admin only
CREATE POLICY api_keys_admin ON public.api_keys
  FOR ALL USING (public.has_org_role(organisation_id, ARRAY['owner','administrator']))
  WITH CHECK (public.has_org_role(organisation_id, ARRAY['owner','administrator']));

CREATE POLICY webhooks_admin ON public.webhooks
  FOR ALL USING (public.has_org_role(organisation_id, ARRAY['owner','administrator']))
  WITH CHECK (public.has_org_role(organisation_id, ARRAY['owner','administrator']));

CREATE POLICY notifications_own ON public.notifications
  FOR SELECT USING (user_id = auth.uid() AND public.is_org_member(organisation_id));
CREATE POLICY notifications_update_own ON public.notifications
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY exceptions_select ON public.exceptions
  FOR SELECT USING (public.is_org_member(organisation_id));
CREATE POLICY exceptions_write ON public.exceptions
  FOR ALL USING (public.has_org_role(organisation_id, ARRAY['owner','administrator','assessment_lead','reviewer']))
  WITH CHECK (public.has_org_role(organisation_id, ARRAY['owner','administrator','assessment_lead','reviewer']));

CREATE POLICY risk_select ON public.risk_acceptances
  FOR SELECT USING (public.is_org_member(organisation_id));
CREATE POLICY risk_write ON public.risk_acceptances
  FOR ALL USING (public.has_org_role(organisation_id, ARRAY['owner','administrator','assessment_lead']))
  WITH CHECK (public.has_org_role(organisation_id, ARRAY['owner','administrator','assessment_lead']));

-- Bootstrap: allow authenticated user to create org + self membership via function
CREATE OR REPLACE FUNCTION public.create_organisation(p_name text, p_slug text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  INSERT INTO public.organisations(name, slug)
  VALUES (p_name, p_slug)
  RETURNING id INTO v_id;
  INSERT INTO public.memberships(organisation_id, user_id, role)
  VALUES (v_id, auth.uid(), 'owner');
  INSERT INTO public.audit_events(organisation_id, actor_id, action, resource_type, resource_id)
  VALUES (v_id, auth.uid(), 'organisation.created', 'organisation', v_id::text);
  RETURN v_id;
END;
$$;

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
-- Revoke secrets + jobs from authenticated (worker uses service_role)
REVOKE ALL ON public.connection_secrets FROM authenticated, anon;
REVOKE ALL ON public.jobs FROM authenticated, anon;
GRANT EXECUTE ON FUNCTION public.create_organisation(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.org_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_org_role(uuid, text[]) TO authenticated;
