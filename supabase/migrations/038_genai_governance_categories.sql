-- GenAI governance categories per org (customisable names, 5 system defaults)
CREATE TABLE org_genai_governance_categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  system_tag  TEXT,          -- maps to CustomerClass enum; NULL for custom categories
  name        TEXT NOT NULL,
  description TEXT,
  color       TEXT NOT NULL DEFAULT 'blue',
  priority    INTEGER NOT NULL DEFAULT 99,
  is_system   BOOLEAN NOT NULL DEFAULT false,
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, system_tag)
);

ALTER TABLE org_genai_governance_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON org_genai_governance_categories
  FOR SELECT USING (org_id = (auth.jwt() ->> 'org_id')::uuid);

CREATE POLICY "org_insert" ON org_genai_governance_categories
  FOR INSERT WITH CHECK (org_id = (auth.jwt() ->> 'org_id')::uuid);

CREATE POLICY "org_update" ON org_genai_governance_categories
  FOR UPDATE USING (org_id = (auth.jwt() ->> 'org_id')::uuid);

CREATE POLICY "org_delete" ON org_genai_governance_categories
  FOR DELETE USING (org_id = (auth.jwt() ->> 'org_id')::uuid AND is_system = false);
