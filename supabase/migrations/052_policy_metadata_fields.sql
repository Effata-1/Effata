ALTER TABLE org_genai_policies
  ADD COLUMN policy_family              TEXT,
  ADD COLUMN generated_from             TEXT,
  ADD COLUMN data_classification_label  TEXT,
  ADD COLUMN primary_action             TEXT,
  ADD COLUMN fallback_action            TEXT,
  ADD COLUMN coaching_template_id       UUID REFERENCES org_coaching_notifications(id) ON DELETE SET NULL,
  ADD COLUMN vendor_translation_status  TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN required_dependencies      UUID[] NOT NULL DEFAULT '{}',
  ADD COLUMN test_status                TEXT NOT NULL DEFAULT 'untested';
