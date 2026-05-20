-- ─────────────────────────────────────────────────────────────────────────────
-- 031_org_identity_mappings.sql
-- Org-specific identity group mappings — customers map their AD groups, OUs,
-- HR attributes, and Okta/Google groups to the 4 standard DLP identity context
-- fields defined in catalog_identity_values (migration 030).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS org_identity_mappings (
  id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id            UUID        NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  catalog_value_id  UUID        NOT NULL REFERENCES catalog_identity_values(id) ON DELETE CASCADE,
  source_name       TEXT        NOT NULL,
  source_type       TEXT        NOT NULL DEFAULT 'custom' CHECK (source_type IN (
    'ad_group', 'ou', 'hr_attribute', 'okta_group', 'google_group', 'custom'
  )),
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, catalog_value_id, source_name)
);

ALTER TABLE org_identity_mappings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_isolation" ON org_identity_mappings;
CREATE POLICY "org_isolation" ON org_identity_mappings
  USING  (org_id = (auth.jwt() ->> 'org_id')::UUID)
  WITH CHECK (org_id = (auth.jwt() ->> 'org_id')::UUID);
