-- Migration 072: Replace partial unique index on policy_key with a full unique constraint
-- The partial index (WHERE policy_key IS NOT NULL) cannot be used by Supabase's
-- onConflict upsert syntax. PostgreSQL allows multiple NULLs in a UNIQUE constraint
-- natively (NULL != NULL), so we don't need the partial filter.

DROP INDEX IF EXISTS idx_org_genai_policies_policy_key;

ALTER TABLE org_genai_policies
  ADD CONSTRAINT org_genai_policies_org_id_policy_key_key
  UNIQUE (org_id, policy_key);
