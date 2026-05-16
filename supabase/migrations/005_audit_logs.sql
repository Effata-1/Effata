-- Migration 005: Activity / audit log

CREATE TABLE IF NOT EXISTS audit_logs (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id      TEXT        NOT NULL,
  user_id     UUID        NOT NULL,
  user_email  TEXT,
  action      TEXT        NOT NULL,
  entity_type TEXT,
  entity_id   TEXT,
  entity_name TEXT,
  old_value   TEXT,
  new_value   TEXT,
  details     JSONB       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_org_created
  ON audit_logs (org_id, created_at DESC);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_select" ON audit_logs
  FOR SELECT USING (org_id = (auth.jwt() ->> 'org_id'));

CREATE POLICY "org_insert" ON audit_logs
  FOR INSERT WITH CHECK (org_id = (auth.jwt() ->> 'org_id'));
