-- Persistent chat history for AI-assisted policy refinement.
-- policy_id = null means global chat across all org policies.
CREATE TABLE genai_policy_chats (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  policy_id  UUID REFERENCES org_genai_policies(id) ON DELETE SET NULL,
  messages   JSONB NOT NULL DEFAULT '[]',
  -- messages: [{ role: 'user'|'assistant', content: string, created_at: string }]
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX genai_policy_chats_org_idx    ON genai_policy_chats (org_id, updated_at DESC);
CREATE INDEX genai_policy_chats_policy_idx ON genai_policy_chats (policy_id) WHERE policy_id IS NOT NULL;

ALTER TABLE genai_policy_chats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_isolation" ON genai_policy_chats
  USING (org_id = (auth.jwt() ->> 'org_id')::uuid);

GRANT SELECT, INSERT, UPDATE ON TABLE public.genai_policy_chats TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.genai_policy_chats TO service_role;
NOTIFY pgrst, 'reload schema';
