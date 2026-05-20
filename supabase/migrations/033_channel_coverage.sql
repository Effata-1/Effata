-- Channel coverage assessment — one row per org per channel slug.
-- Assessment answers are stored as JSON: { question_key: 'not_assessed' | 'partial' | 'covered' }

CREATE TABLE channel_coverage (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid        NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  channel_slug        text        NOT NULL,
  assessment_answers  jsonb       NOT NULL DEFAULT '{}',
  notes               text,
  last_updated_by     uuid        REFERENCES users(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, channel_slug)
);

ALTER TABLE channel_coverage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON channel_coverage
  USING (org_id = (auth.jwt() ->> 'org_id')::uuid);
