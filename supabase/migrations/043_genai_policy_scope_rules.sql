-- P1-4: Policy Builder — add app scope + DLP rules to org_genai_policies

ALTER TABLE org_genai_policies
  ADD COLUMN IF NOT EXISTS scope_all_apps BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS scope_app_ids  TEXT[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS rules          JSONB   DEFAULT '[]';
