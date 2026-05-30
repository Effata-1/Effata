-- Add access_posture to governance categories.
-- 'allow'  = users can reach apps in this category; DLP fires on data activities.
-- 'block'  = access denied at browse+login level; a govern_app_access policy is compiled.
-- Prohibited categories are initialised to 'block'; all others default to 'allow'.

ALTER TABLE org_genai_governance_categories
  ADD COLUMN IF NOT EXISTS access_posture TEXT NOT NULL DEFAULT 'allow'
    CHECK (access_posture IN ('allow', 'block'));

UPDATE org_genai_governance_categories
  SET access_posture = 'block'
  WHERE system_tag = 'prohibited';
