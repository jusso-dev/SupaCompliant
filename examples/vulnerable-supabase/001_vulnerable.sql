-- INTENTIONALLY VULNERABLE — DO NOT USE IN PRODUCTION
CREATE SCHEMA IF NOT EXISTS app;

CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  title text NOT NULL,
  body text,
  owner_id uuid
);
-- Missing RLS

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  org_id uuid NOT NULL,
  display_name text,
  api_token text
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY profiles_open ON public.profiles
  FOR ALL USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.admin_list_documents()
RETURNS SETOF public.documents
LANGUAGE sql
SECURITY DEFINER
-- missing SET search_path
AS $$
  SELECT * FROM public.documents;
$$;
GRANT EXECUTE ON FUNCTION public.admin_list_documents() TO anon, authenticated, PUBLIC;

CREATE TABLE public.embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  content text,
  embedding text
);
-- vector-like column name without RLS

GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.embeddings TO anon, authenticated;
