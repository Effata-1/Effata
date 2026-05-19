-- AI search activity log (all user-initiated AI calls across the app)
CREATE TABLE ai_search_logs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     TEXT NOT NULL,
  user_id    UUID REFERENCES auth.users(id),
  source     TEXT NOT NULL,  -- 'file_generator' | 'test_data' | 'regex_lab' | 'evidence_report'
  prompt     TEXT NOT NULL,
  result     TEXT,           -- filename / pattern / summary (truncated to 500 chars)
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE ai_search_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_isolation" ON ai_search_logs
  USING (org_id = (auth.jwt() ->> 'org_id'));
CREATE INDEX ai_search_logs_org_created ON ai_search_logs(org_id, created_at DESC);

-- Learned templates discovered from AI file generation (per-org, no duplicate extensions)
CREATE TABLE ai_learned_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      TEXT NOT NULL,
  ext         TEXT NOT NULL,
  filename    TEXT NOT NULL,
  description TEXT NOT NULL,
  content     TEXT NOT NULL,
  mime_type   TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, ext)
);

ALTER TABLE ai_learned_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_isolation" ON ai_learned_templates
  USING (org_id = (auth.jwt() ->> 'org_id'));
