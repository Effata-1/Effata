-- ─────────────────────────────────────────────────────────────────────────────
-- 023_destination_trust.sql
-- Destination Trust Layer — org inventory of trusted/restricted destinations.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS org_destinations (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id           UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  destination_type TEXT NOT NULL,
  trust_tag        TEXT NOT NULL CHECK (trust_tag IN (
    'enterprise_approved',
    'approved_with_conditions',
    'permitted_with_restriction',
    'personal',
    'public',
    'unknown',
    'prohibited'
  )),
  risk_level       TEXT CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  risk_notes       TEXT,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE org_destinations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON org_destinations
  USING  (org_id = (auth.jwt() ->> 'org_id')::UUID)
  WITH CHECK (org_id = (auth.jwt() ->> 'org_id')::UUID);

CREATE INDEX IF NOT EXISTS idx_org_destinations_org_id
  ON org_destinations (org_id);

CREATE INDEX IF NOT EXISTS idx_org_destinations_trust_tag
  ON org_destinations (org_id, trust_tag);

CREATE TRIGGER set_org_destinations_updated_at
  BEFORE UPDATE ON org_destinations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
