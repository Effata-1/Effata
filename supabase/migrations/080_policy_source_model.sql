-- Migration 080: Policy Source Model (Recommended + Manual)
-- Safe for fresh or partially migrated DBs — uses ADD COLUMN IF NOT EXISTS throughout.
-- Apply in Supabase SQL Editor before deploying code.

-- ── Add base columns if they don't exist yet ──────────────────────────────────
ALTER TABLE org_genai_policies
  ADD COLUMN IF NOT EXISTS policy_source TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS is_customized  BOOLEAN      DEFAULT false,
  ADD COLUMN IF NOT EXISTS policy_key     TEXT;

-- ── Unique index for upsert conflict-target ───────────────────────────────────
-- Normal (non-partial) index required for Supabase .upsert({ onConflict: 'org_id,policy_key' }).
-- Postgres allows multiple NULLs in a non-partial unique index, so Manual
-- policies with policy_key = null remain safe.
CREATE UNIQUE INDEX IF NOT EXISTS org_genai_policies_org_key_uidx
  ON org_genai_policies (org_id, policy_key);

-- ── Migrate existing policy_source values to new enum ────────────────────────
UPDATE org_genai_policies
  SET policy_source = 'recommended'
  WHERE policy_source IN ('predefined', 'matrix');

UPDATE org_genai_policies
  SET policy_source = 'manual'
  WHERE policy_source = 'custom';

-- ── Replace policy_source check constraint ────────────────────────────────────
ALTER TABLE org_genai_policies
  DROP CONSTRAINT IF EXISTS org_genai_policies_policy_source_check;

ALTER TABLE org_genai_policies
  ADD CONSTRAINT org_genai_policies_policy_source_check
  CHECK (policy_source IN ('recommended', 'manual'));

-- ── Add new tracking columns ──────────────────────────────────────────────────
ALTER TABLE org_genai_policies
  ADD COLUMN IF NOT EXISTS matrix_basis TEXT
    CHECK (matrix_basis IS NULL OR matrix_basis IN ('default', 'customized'));

ALTER TABLE org_genai_policies
  ADD COLUMN IF NOT EXISTS last_synced_from_matrix_at TIMESTAMPTZ;

-- ── Backfill matrix_basis for existing recommended policies ───────────────────
UPDATE org_genai_policies
  SET matrix_basis = CASE WHEN is_customized = true THEN 'customized' ELSE 'default' END
  WHERE policy_source = 'recommended';

-- is_customized kept for backward compat; no longer used in app logic
