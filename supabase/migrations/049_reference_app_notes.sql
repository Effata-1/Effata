-- Per-org notes on reference (static) blocked applications
CREATE TABLE org_reference_app_notes (
  org_id     UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  app_slug   TEXT NOT NULL,
  notes      TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (org_id, app_slug)
);

ALTER TABLE org_reference_app_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_select" ON org_reference_app_notes
  FOR SELECT USING (org_id = (auth.jwt() ->> 'org_id')::uuid);

CREATE POLICY "org_insert" ON org_reference_app_notes
  FOR INSERT WITH CHECK (org_id = (auth.jwt() ->> 'org_id')::uuid);

CREATE POLICY "org_update" ON org_reference_app_notes
  FOR UPDATE USING (org_id = (auth.jwt() ->> 'org_id')::uuid);

CREATE POLICY "org_delete" ON org_reference_app_notes
  FOR DELETE USING (org_id = (auth.jwt() ->> 'org_id')::uuid);
