-- Stores per-org overrides for the GenAI Control Matrix cells.
-- Each row overrides the default recommended DLP action for a specific
-- (data_type, governance_category) pair. Absence of a row means use the default.

CREATE TABLE org_control_matrix_overrides (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  data_type   TEXT NOT NULL,
  category_id UUID NOT NULL REFERENCES org_genai_governance_categories(id) ON DELETE CASCADE,
  action_code TEXT NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, data_type, category_id)
);

ALTER TABLE org_control_matrix_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON org_control_matrix_overrides
  USING (org_id = (auth.jwt() ->> 'org_id')::uuid);

CREATE POLICY "org_insert" ON org_control_matrix_overrides
  FOR INSERT WITH CHECK (org_id = (auth.jwt() ->> 'org_id')::uuid);

CREATE POLICY "org_update" ON org_control_matrix_overrides
  FOR UPDATE USING (org_id = (auth.jwt() ->> 'org_id')::uuid);

CREATE POLICY "org_delete" ON org_control_matrix_overrides
  FOR DELETE USING (org_id = (auth.jwt() ->> 'org_id')::uuid);
