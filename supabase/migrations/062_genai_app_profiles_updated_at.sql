-- genai_app_profiles was created without updated_at.
-- The evaluate endpoint uses it to check whether a cached profile is stale (7-day window).
ALTER TABLE genai_app_profiles
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Backfill existing rows so the freshness check doesn't immediately re-research everything.
UPDATE genai_app_profiles SET updated_at = NOW() WHERE updated_at IS NULL;

-- Grant service_role write access (needed for backend upserts).
GRANT SELECT, INSERT, UPDATE ON TABLE public.genai_app_profiles TO service_role;
GRANT SELECT                  ON TABLE public.genai_app_profiles TO authenticated;
