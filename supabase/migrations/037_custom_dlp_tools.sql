-- Custom DLP tools added by users per org
CREATE TABLE custom_dlp_tools (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid        NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES auth.users(id)    ON DELETE CASCADE,
  tool_name   text        NOT NULL,
  is_real_dlp boolean,
  status      text        NOT NULL DEFAULT 'custom', -- 'verified' | 'custom'
  tool_data   jsonb       NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE custom_dlp_tools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON custom_dlp_tools
  USING (org_id = (auth.jwt() ->> 'org_id')::uuid);

CREATE INDEX custom_dlp_tools_org_created
  ON custom_dlp_tools (org_id, created_at DESC);
