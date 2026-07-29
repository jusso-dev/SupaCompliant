-- Example remediation (partial) for the vulnerable sample
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS documents_tenant ON public.documents;
CREATE POLICY documents_tenant ON public.documents
  FOR ALL
  USING (org_id = (auth.jwt() ->> 'org_id')::uuid)
  WITH CHECK (org_id = (auth.jwt() ->> 'org_id')::uuid);

DROP POLICY IF EXISTS profiles_open ON public.profiles;
CREATE POLICY profiles_self ON public.profiles
  FOR SELECT USING (id = auth.uid());
CREATE POLICY profiles_self_update ON public.profiles
  FOR UPDATE USING (id = auth.uid());

CREATE OR REPLACE FUNCTION public.admin_list_documents()
RETURNS SETOF public.documents
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT * FROM public.documents WHERE org_id = (auth.jwt() ->> 'org_id')::uuid;
$$;
REVOKE ALL ON FUNCTION public.admin_list_documents() FROM PUBLIC, anon, authenticated;

ALTER TABLE public.embeddings ENABLE ROW LEVEL SECURITY;
CREATE POLICY embeddings_tenant ON public.embeddings
  FOR ALL
  USING (org_id = (auth.jwt() ->> 'org_id')::uuid)
  WITH CHECK (org_id = (auth.jwt() ->> 'org_id')::uuid);
