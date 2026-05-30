-- Migration 073: Fix missing columns in genai_apps and genai_research_runs.
--
-- genai_apps.logo_url was added in 066 but never applied to production.
-- genai_research_runs.apps_checked and .error were never added despite being
-- referenced by the research-runs route and processor.
-- The status CHECK constraint also excludes 'partial' and 'timed_out' values
-- that the refresh processor writes.

-- Ensure logo_url exists (re-applies 066 safely)
ALTER TABLE genai_apps ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Backfill logo_url for rows that already exist
-- regexp_match (singular) returns TEXT[] — safe in UPDATE unlike set-returning regexp_matches
UPDATE genai_apps
SET logo_url = 'https://www.google.com/s2/favicons?domain_url=https://' ||
  (regexp_match(domain, '([^./]+\.[^./]+)(?:/|$)'))[1] || '&sz=128'
WHERE logo_url IS NULL AND domain IS NOT NULL AND domain <> '';

-- Add missing columns to genai_research_runs
ALTER TABLE genai_research_runs
  ADD COLUMN IF NOT EXISTS apps_checked INT  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS error        TEXT;

-- Expand status CHECK to include values the processor actually writes
ALTER TABLE genai_research_runs
  DROP CONSTRAINT IF EXISTS genai_research_runs_status_check;

ALTER TABLE genai_research_runs
  ADD CONSTRAINT genai_research_runs_status_check
  CHECK (status IN ('running', 'completed', 'failed', 'partial', 'timed_out'));
