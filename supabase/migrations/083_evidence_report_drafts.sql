-- Migration: Evidence report draft auto-save + file attachments
-- Adds: status column, ai_conversation column, report_attachments table,
--       storage bucket + RLS policies for evidence-attachments.

-- ── Storage bucket ─────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('evidence-attachments', 'evidence-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- ── evidence_reports: new columns ─────────────────────────────────────────────

-- status: default 'complete' so all existing reports are unaffected.
-- saveDraft() explicitly inserts status = 'draft'.
ALTER TABLE evidence_reports
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'complete'
    CHECK (status IN ('draft', 'complete'));

-- ai_conversation stores { apiMessages, displayMessages } JSON for resuming.
ALTER TABLE evidence_reports
  ADD COLUMN IF NOT EXISTS ai_conversation JSONB;

-- ── report_attachments table ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS report_attachments (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id      UUID        NOT NULL REFERENCES organisations(id),
  report_id   UUID        NOT NULL REFERENCES evidence_reports(id) ON DELETE CASCADE,
  test_id     UUID        REFERENCES report_tests(id) ON DELETE SET NULL,
  file_name   TEXT        NOT NULL,   -- sanitized display name
  file_path   TEXT        NOT NULL,   -- storage path: {org_id}/{report_id}/{uuid}
  file_type   TEXT        NOT NULL,   -- verified MIME type
  file_size   INTEGER     NOT NULL,   -- bytes (verified server-side)
  uploaded_by UUID        REFERENCES profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE report_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_attachment_select" ON report_attachments;
CREATE POLICY "org_attachment_select" ON report_attachments
  FOR SELECT USING (org_id::text = (auth.jwt() ->> 'org_id'));

DROP POLICY IF EXISTS "org_attachment_insert" ON report_attachments;
CREATE POLICY "org_attachment_insert" ON report_attachments
  FOR INSERT WITH CHECK (org_id::text = (auth.jwt() ->> 'org_id'));

DROP POLICY IF EXISTS "org_attachment_delete" ON report_attachments;
CREATE POLICY "org_attachment_delete" ON report_attachments
  FOR DELETE USING (org_id::text = (auth.jwt() ->> 'org_id'));

-- ── Storage object policies ────────────────────────────────────────────────────

DROP POLICY IF EXISTS "org_storage_select" ON storage.objects;
CREATE POLICY "org_storage_select" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'evidence-attachments'
    AND (storage.foldername(name))[1] = (auth.jwt() ->> 'org_id')
  );

DROP POLICY IF EXISTS "org_storage_insert" ON storage.objects;
CREATE POLICY "org_storage_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'evidence-attachments'
    AND (storage.foldername(name))[1] = (auth.jwt() ->> 'org_id')
  );

DROP POLICY IF EXISTS "org_storage_delete" ON storage.objects;
CREATE POLICY "org_storage_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'evidence-attachments'
    AND (storage.foldername(name))[1] = (auth.jwt() ->> 'org_id')
  );
