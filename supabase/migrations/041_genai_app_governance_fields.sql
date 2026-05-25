-- Add governance metadata fields to genai_customer_classifications (per-org, editable)
ALTER TABLE genai_customer_classifications
  ADD COLUMN IF NOT EXISTS business_owner        TEXT,
  ADD COLUMN IF NOT EXISTS technical_owner       TEXT,
  ADD COLUMN IF NOT EXISTS approval_status       TEXT DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS review_date           DATE,
  ADD COLUMN IF NOT EXISTS next_review_date      DATE,
  ADD COLUMN IF NOT EXISTS contract_status       TEXT DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS dpa_status            TEXT DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS security_review_status TEXT DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS tenant_instance_id    TEXT,
  ADD COLUMN IF NOT EXISTS dlp_coverage          TEXT DEFAULT 'requires-validation';

-- Add functional app group to the global genai_apps table
ALTER TABLE genai_apps
  ADD COLUMN IF NOT EXISTS app_group TEXT;
