-- Migration 027: org_destination_trust_labels
-- Stores per-org display names, colours, and priority order for the 7 destination
-- trust tags.  Mirrors org_classification_labels exactly.

CREATE TABLE IF NOT EXISTS org_destination_trust_labels (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id      UUID        NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  system_tag  TEXT,       -- one of the 7 TrustTag enum values, NULL for custom tiers
  name        TEXT        NOT NULL,
  color       TEXT        NOT NULL DEFAULT 'zinc',
  priority    INT         NOT NULL,
  description TEXT,
  is_system   BOOLEAN     NOT NULL DEFAULT FALSE,
  active      BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- allows multiple custom rows per org (NULL != NULL in unique constraints)
  UNIQUE (org_id, system_tag)
);

ALTER TABLE org_destination_trust_labels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON org_destination_trust_labels
  USING  (org_id = (auth.jwt() ->> 'org_id')::UUID)
  WITH CHECK (org_id = (auth.jwt() ->> 'org_id')::UUID);

CREATE TRIGGER set_org_dest_trust_labels_updated_at
  BEFORE UPDATE ON org_destination_trust_labels
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
