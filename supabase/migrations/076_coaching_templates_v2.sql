-- Add v2 columns to org_coaching_notifications
-- Extends the table for the full Coaching Message Template Library:
-- control_type, subtitle, description, exception/details toggles,
-- recommended_for tags, tokens_used (auto-computed), and a stable template_key for idempotent seeding.

ALTER TABLE org_coaching_notifications
  ADD COLUMN IF NOT EXISTS description         TEXT,
  ADD COLUMN IF NOT EXISTS subtitle            TEXT,
  ADD COLUMN IF NOT EXISTS control_type        TEXT NOT NULL DEFAULT 'coach_acknowledge',
  ADD COLUMN IF NOT EXISTS show_exception_line BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_details        BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS recommended_for     TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS tokens_used         TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS template_key        TEXT;

-- Unique index per org so idempotent seeding can use ON CONFLICT DO NOTHING
CREATE UNIQUE INDEX IF NOT EXISTS org_coaching_notifications_org_key
  ON org_coaching_notifications (org_id, template_key)
  WHERE template_key IS NOT NULL;

-- Guard: only known control_type values allowed
ALTER TABLE org_coaching_notifications
  ADD CONSTRAINT org_coaching_notifications_control_type_check
  CHECK (control_type IN ('block', 'coach_acknowledge', 'coach_justification', 'monitor', 'allow'));
