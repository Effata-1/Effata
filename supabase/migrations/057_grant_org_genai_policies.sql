-- org_genai_policies was created (migration 042) before Supabase auto-grants
-- were applied to new tables. Service role needs explicit GRANT to INSERT/UPDATE
-- from the Railway worker. No anon access — policies are sensitive org data.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.org_genai_policies TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.org_genai_policies TO service_role;
NOTIFY pgrst, 'reload schema';
