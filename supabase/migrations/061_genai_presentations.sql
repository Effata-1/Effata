-- CISO presentation snapshots with controlled public sharing.
-- is_public defaults false — only set true when user explicitly clicks "Share with CISO".
-- Snapshot is sanitized (no email addresses, no internal UUIDs in display fields).
CREATE TABLE genai_presentations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  public_token UUID NOT NULL DEFAULT gen_random_uuid(),
  title        TEXT NOT NULL DEFAULT 'GenAI DLP Policy Pack',
  snapshot     JSONB NOT NULL,
  -- snapshot: { org_name, industry, coverage_score, top_gaps, app_counts, policies[], generated_at }
  is_public    BOOLEAN NOT NULL DEFAULT false,
  expires_at   TIMESTAMPTZ,   -- null = no expiry
  revoked_at   TIMESTAMPTZ,   -- non-null = revoked (link dead)
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (public_token)
);

CREATE INDEX genai_presentations_org_idx   ON genai_presentations (org_id, created_at DESC);
CREATE INDEX genai_presentations_token_idx ON genai_presentations (public_token);

ALTER TABLE genai_presentations ENABLE ROW LEVEL SECURITY;

-- Org members can read/write their own presentations
CREATE POLICY "org_write" ON genai_presentations
  USING (org_id = (auth.jwt() ->> 'org_id')::uuid);

-- Public can read presentations that are explicitly shared, not revoked, and not expired
CREATE POLICY "public_read" ON genai_presentations
  FOR SELECT USING (
    is_public = true
    AND revoked_at IS NULL
    AND (expires_at IS NULL OR expires_at > now())
  );

GRANT SELECT, INSERT, UPDATE ON TABLE public.genai_presentations TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.genai_presentations TO service_role;
GRANT SELECT                  ON TABLE public.genai_presentations TO anon;
NOTIFY pgrst, 'reload schema';
