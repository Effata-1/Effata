-- 008 · DLP test results
-- Stores the outcome of every DLP control verification test run by a user.

CREATE TABLE dlp_test_results (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID        NOT NULL,
  user_id          UUID        NOT NULL REFERENCES auth.users(id),
  test_name        TEXT        NOT NULL,
  protocol         TEXT        NOT NULL,
  data_type        TEXT        NOT NULL,
  destination      TEXT        NOT NULL,
  result           TEXT        NOT NULL CHECK (result IN ('blocked','not_blocked','error')),
  response_code    INTEGER,
  response_time_ms INTEGER,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE dlp_test_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON dlp_test_results
  FOR ALL USING ((auth.jwt() ->> 'org_id')::uuid = org_id);

CREATE INDEX dlp_test_results_org_created
  ON dlp_test_results (org_id, created_at DESC);
