-- 017 · Evidence Reports
-- Analyst-authored DLP test reports: each report contains structured test
-- records with regulation mapping, expected/actual results, gaps, and
-- recommendations — for audit, compliance, and CISO evidence packs.

-- ── evidence_reports — one row per named report ────────────────────────────

CREATE TABLE IF NOT EXISTS evidence_reports (
  id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id         UUID        NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  created_by     UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  name           TEXT        NOT NULL,
  assessed_on    DATE        NOT NULL,
  tested_by      TEXT        NOT NULL,
  environment    TEXT        NOT NULL DEFAULT 'UAT',
  report_type    TEXT        NOT NULL DEFAULT 'control_validation'
    CHECK (report_type IN (
      'single_test','control_validation','regulation','executive','regression'
    )),
  overall_result TEXT        NOT NULL DEFAULT 'inconclusive'
    CHECK (overall_result IN ('passed','partially_passed','failed','inconclusive')),
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_evidence_reports_org_created
  ON evidence_reports (org_id, created_at DESC);

ALTER TABLE evidence_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_manage_evidence_reports" ON evidence_reports
  FOR ALL
  USING     (org_id = (auth.jwt() ->> 'org_id')::UUID)
  WITH CHECK (org_id = (auth.jwt() ->> 'org_id')::UUID);

CREATE TRIGGER evidence_reports_updated_at
  BEFORE UPDATE ON evidence_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── report_tests — one row per test record within a report ─────────────────

CREATE TABLE IF NOT EXISTS report_tests (
  id                   UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id               UUID        NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  report_id            UUID        NOT NULL REFERENCES evidence_reports(id) ON DELETE CASCADE,
  test_code            TEXT        NOT NULL,
  channel              TEXT        NOT NULL DEFAULT 'Web',
  test_vector          TEXT        NOT NULL,
  data_type            TEXT        NOT NULL,
  regulation_tags      TEXT[]      NOT NULL DEFAULT '{}',
  control_mapping      TEXT,
  severity             TEXT        NOT NULL DEFAULT 'medium'
    CHECK (severity IN ('critical','high','medium','low')),
  expected_result      TEXT        NOT NULL DEFAULT 'block'
    CHECK (expected_result IN ('block','allow_alert','allow_coach','allow')),
  expected_policy      TEXT,
  expected_alert       BOOLEAN     NOT NULL DEFAULT TRUE,
  expected_description TEXT,
  actual_result        TEXT        NOT NULL DEFAULT 'inconclusive'
    CHECK (actual_result IN (
      'blocked','allowed_with_alert','allowed_with_coach',
      'allowed_no_alert','not_inspected','test_failed','inconclusive'
    )),
  http_response_code   INTEGER,
  response_time_ms     INTEGER,
  dlp_alert_generated  BOOLEAN,
  final_status         TEXT        NOT NULL DEFAULT 'inconclusive'
    CHECK (final_status IN ('passed','failed','inconclusive')),
  gap_reason           TEXT
    CHECK (gap_reason IN (
      'policy_not_configured','monitor_mode','ssl_inspection_missing',
      'user_not_in_scope','destination_not_in_scope','regex_too_weak',
      'file_type_unsupported','activity_unsupported','threshold_too_high','other'
    )),
  gap_notes            TEXT,
  recommendation       TEXT,
  payload_summary      TEXT,
  data_source          TEXT        NOT NULL DEFAULT 'Data Lab (Synthetic)',
  evidence_notes       TEXT,
  linked_test_id       UUID        REFERENCES dlp_test_results(id) ON DELETE SET NULL,
  sort_order           INTEGER     NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_report_tests_report
  ON report_tests (org_id, report_id, sort_order);

ALTER TABLE report_tests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_manage_report_tests" ON report_tests
  FOR ALL
  USING     (org_id = (auth.jwt() ->> 'org_id')::UUID)
  WITH CHECK (org_id = (auth.jwt() ->> 'org_id')::UUID);

CREATE TRIGGER report_tests_updated_at
  BEFORE UPDATE ON report_tests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
