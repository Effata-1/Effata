-- Migration 007: Test Datasets
-- Org-scoped table for saving generated DLP test datasets

CREATE TABLE IF NOT EXISTS test_datasets (
  id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id         UUID        NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name           TEXT        NOT NULL,
  description    TEXT,
  columns        TEXT[]      NOT NULL DEFAULT '{}',
  records        JSONB       NOT NULL DEFAULT '[]',
  row_count      INT         NOT NULL DEFAULT 0,
  ai_generated   BOOLEAN     NOT NULL DEFAULT FALSE,
  ai_prompt      TEXT,
  created_by     UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_test_datasets_org_created
  ON test_datasets (org_id, created_at DESC);

ALTER TABLE test_datasets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_manage_test_datasets" ON test_datasets
  FOR ALL
  USING     (org_id = (auth.jwt() ->> 'org_id')::UUID)
  WITH CHECK (org_id = (auth.jwt() ->> 'org_id')::UUID);

-- set_updated_at() already created in migration 002 — do not redefine
CREATE TRIGGER test_datasets_updated_at
  BEFORE UPDATE ON test_datasets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
