-- dlp_coverage_ai_reviews was created (migration 034) before Supabase auto-grants
-- were applied to new tables. Without these grants PostgREST cannot include
-- the table in its schema cache and all REST API access returns PGRST204.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.dlp_coverage_ai_reviews TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.dlp_coverage_ai_reviews TO service_role;
GRANT SELECT                          ON TABLE public.dlp_coverage_ai_reviews TO anon;
