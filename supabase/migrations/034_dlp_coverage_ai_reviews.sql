-- AI coverage review table: stores Claude's monthly + on-demand gap analysis results
CREATE TABLE dlp_coverage_ai_reviews (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid        NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  review_type      text        NOT NULL DEFAULT 'scheduled', -- 'scheduled' | 'manual'
  coverage_score   int,
  gaps             jsonb       NOT NULL DEFAULT '[]',
  recommendations  jsonb       NOT NULL DEFAULT '[]',
  raw_response     text,
  reviewed_at      timestamptz NOT NULL DEFAULT now(),
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE dlp_coverage_ai_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON dlp_coverage_ai_reviews
  USING (org_id = (auth.jwt() ->> 'org_id')::uuid);

CREATE INDEX dlp_coverage_ai_reviews_org_id_reviewed_at
  ON dlp_coverage_ai_reviews (org_id, reviewed_at DESC);

-- Monthly cron: 9am UTC on the 1st of each month
SELECT cron.schedule(
  'monthly-dlp-coverage-review',
  '0 9 1 * *',
  $$
    SELECT net.http_post(
      url     := current_setting('app.supabase_url') || '/functions/v1/review-dlp-coverage',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
        'Content-Type',  'application/json'
      ),
      body    := '{"source":"cron"}'::jsonb
    )
  $$
);
