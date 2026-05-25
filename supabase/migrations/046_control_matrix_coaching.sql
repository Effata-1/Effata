-- Link a coaching notification to each control matrix cell override
ALTER TABLE org_control_matrix_overrides
  ADD COLUMN IF NOT EXISTS coaching_notification_id UUID
    REFERENCES org_coaching_notifications(id) ON DELETE SET NULL;
