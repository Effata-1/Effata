-- Migration 070: Neutral Policy JSON
-- Adds neutral_policy_json (translation-grade policy object), neutral_policy_version,
-- neutral_policy_hash (staleness detection), and policy_key (stable compiler-assigned upsert key).
-- Existing org_genai_policies columns remain unchanged for UI display and backward compat.

ALTER TABLE org_genai_policies
  ADD COLUMN IF NOT EXISTS neutral_policy_json    JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS neutral_policy_version TEXT  NOT NULL DEFAULT '1.0',
  ADD COLUMN IF NOT EXISTS neutral_policy_hash    TEXT,
  ADD COLUMN IF NOT EXISTS policy_key             TEXT;

-- One compiled policy per (org, key). NULL policy_key = manual/legacy — excluded from uniqueness.
CREATE UNIQUE INDEX IF NOT EXISTS idx_org_genai_policies_policy_key
  ON org_genai_policies(org_id, policy_key)
  WHERE policy_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_org_genai_policies_neutral_hash
  ON org_genai_policies(neutral_policy_hash)
  WHERE neutral_policy_hash IS NOT NULL;
