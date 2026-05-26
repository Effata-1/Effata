-- Add identity_context to GenAI policies.
-- Stores an array of catalog_identity_value IDs the policy applies to.
-- NULL / empty = applies to all users.
ALTER TABLE org_genai_policies
  ADD COLUMN IF NOT EXISTS identity_context UUID[] DEFAULT NULL;
