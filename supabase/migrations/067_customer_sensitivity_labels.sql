-- Customer / MIP sensitivity labels
-- These are the document sensitivity labels applied by the customer's own
-- classification tooling (Microsoft Purview MIP, TITUS, Boldon James, custom).
-- They drive the "Upload — Data Classification Labels" section of the control
-- matrix and generate separate "GenAI Label Detection" policies.
-- Separate from org_classification_labels (Effata system model).

CREATE TABLE org_customer_sensitivity_labels (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  -- label_key: the metadata attribute key the DLP tool reads from the file
  -- e.g. "MSIP_Label_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx_Enabled"
  label_key    TEXT NOT NULL,
  -- label_value: the metadata attribute value to match, usually "True" or "1"
  label_value  TEXT NOT NULL DEFAULT 'True',
  label_source TEXT NOT NULL DEFAULT 'mip'
    CHECK (label_source IN ('mip', 'titus', 'boldon-james', 'custom')),
  color        TEXT NOT NULL DEFAULT 'zinc',
  -- system_level: optional mapping to Effata severity tier for default actions
  system_level TEXT
    CHECK (system_level IS NULL OR system_level IN
      ('secret', 'highly_confidential', 'confidential', 'internal', 'public')),
  priority     INT  NOT NULL DEFAULT 1,
  active       BOOLEAN NOT NULL DEFAULT TRUE,   -- soft-delete only
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, label_key)
);

ALTER TABLE org_customer_sensitivity_labels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON org_customer_sensitivity_labels
  USING (org_id = (auth.jwt() ->> 'org_id')::uuid);

-- authenticated users: SELECT, INSERT, UPDATE only (soft-delete via UPDATE active=false)
GRANT SELECT, INSERT, UPDATE ON TABLE public.org_customer_sensitivity_labels TO authenticated;
-- service_role retains full access for admin / cleanup operations
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.org_customer_sensitivity_labels TO service_role;
