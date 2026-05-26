-- Add in_scope and classification override to reference app notes
ALTER TABLE org_reference_app_notes
  ADD COLUMN IF NOT EXISTS in_scope       BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS classification TEXT    DEFAULT NULL;
