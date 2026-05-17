-- Tracks when AI last changed regulation content (vs last_verified_at which resets on every run)
ALTER TABLE compliance_regulations
  ADD COLUMN IF NOT EXISTS content_updated_at timestamptz;
