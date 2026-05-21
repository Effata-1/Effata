-- DLP Advisor chat history: saves user conversations for 30 days
CREATE TABLE dlp_advisor_chats (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid        NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES auth.users(id)   ON DELETE CASCADE,
  title       text        NOT NULL,
  messages    jsonb       NOT NULL DEFAULT '[]',
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL DEFAULT (now() + interval '30 days')
);

ALTER TABLE dlp_advisor_chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON dlp_advisor_chats
  USING (org_id = (auth.jwt() ->> 'org_id')::uuid);

CREATE INDEX dlp_advisor_chats_org_user_created
  ON dlp_advisor_chats (org_id, user_id, created_at DESC);

CREATE INDEX dlp_advisor_chats_expires
  ON dlp_advisor_chats (expires_at);

-- Daily cleanup of expired chats
SELECT cron.schedule(
  'dlp-advisor-cleanup',
  '0 3 * * *',
  $$DELETE FROM dlp_advisor_chats WHERE expires_at < now()$$
);
