-- Migration 079: Add predefined policy provenance columns
-- Adds policy_source, is_customized, policy_key to track Effata-seeded vs user-created policies.

ALTER TABLE org_genai_policies
  ADD COLUMN IF NOT EXISTS policy_source TEXT NOT NULL DEFAULT 'custom'
    CHECK (policy_source IN ('predefined', 'matrix', 'custom')),
  ADD COLUMN IF NOT EXISTS is_customized BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS policy_key TEXT;

-- Unique partial index: prevents duplicate seeds under concurrent page loads
CREATE UNIQUE INDEX IF NOT EXISTS org_genai_policies_org_key_uidx
  ON org_genai_policies (org_id, policy_key)
  WHERE policy_key IS NOT NULL;
