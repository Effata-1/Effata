-- Migration 006: Regex Pattern Library
-- Org-scoped table for saving custom DLP regex patterns

CREATE TABLE IF NOT EXISTS regex_patterns (
  id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id         UUID        NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name           TEXT        NOT NULL,
  description    TEXT,
  pattern        TEXT        NOT NULL,
  flags          TEXT        NOT NULL DEFAULT 'gi',
  test_data      TEXT,
  ai_generated   BOOLEAN     NOT NULL DEFAULT FALSE,
  ai_explanation TEXT,
  created_by     UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_regex_patterns_org_created
  ON regex_patterns (org_id, created_at DESC);

ALTER TABLE regex_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_manage_regex_patterns" ON regex_patterns
  FOR ALL
  USING     (org_id = (auth.jwt() ->> 'org_id')::UUID)
  WITH CHECK (org_id = (auth.jwt() ->> 'org_id')::UUID);

-- set_updated_at() already created in migration 002 — do not redefine
CREATE TRIGGER regex_patterns_updated_at
  BEFORE UPDATE ON regex_patterns
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
