CREATE TABLE org_coaching_notifications (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  action_code       TEXT NOT NULL DEFAULT 'coach',
  title             TEXT NOT NULL,
  message           TEXT NOT NULL,
  tone              TEXT NOT NULL DEFAULT 'informational',
  linked_policy_id  UUID REFERENCES org_genai_policies(id) ON DELETE SET NULL,
  is_default        BOOLEAN NOT NULL DEFAULT false,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE org_coaching_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON org_coaching_notifications
  USING (org_id = (auth.jwt() ->> 'org_id')::uuid);

CREATE POLICY "org_insert" ON org_coaching_notifications
  FOR INSERT WITH CHECK (org_id = (auth.jwt() ->> 'org_id')::uuid);

CREATE POLICY "org_update" ON org_coaching_notifications
  FOR UPDATE USING (org_id = (auth.jwt() ->> 'org_id')::uuid);

CREATE POLICY "org_delete" ON org_coaching_notifications
  FOR DELETE USING (org_id = (auth.jwt() ->> 'org_id')::uuid);
