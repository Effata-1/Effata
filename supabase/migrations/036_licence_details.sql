-- Add per-tool licence details to onboarding profiles
-- Structure: { "tool-id": { seats, cycle, startDate, endDate, notes } }
ALTER TABLE onboarding_profiles
  ADD COLUMN IF NOT EXISTS licence_details jsonb NOT NULL DEFAULT '{}';
