CREATE TABLE IF NOT EXISTS org_identity_scope (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id           UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  catalog_value_id UUID NOT NULL REFERENCES catalog_identity_values(id) ON DELETE CASCADE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, catalog_value_id)
);

ALTER TABLE org_identity_scope ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON org_identity_scope
  USING  (org_id = (auth.jwt() ->> 'org_id')::UUID)
  WITH CHECK (org_id = (auth.jwt() ->> 'org_id')::UUID);
