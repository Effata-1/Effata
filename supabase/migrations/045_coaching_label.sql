-- Add coach_label column to org_coaching_notifications
-- Allows short reference labels (Coach 1, Coach 2…) for use in Control Matrix
ALTER TABLE org_coaching_notifications
  ADD COLUMN IF NOT EXISTS coach_label TEXT;