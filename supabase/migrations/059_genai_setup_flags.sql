-- Track which GenAI setup steps the user has explicitly confirmed.
-- Steps that auto-seed (labels, control matrix) need an explicit acknowledgement
-- flag since data always exists — threshold-based detection would always be true.
ALTER TABLE onboarding_profiles
  ADD COLUMN IF NOT EXISTS genai_setup_flags JSONB NOT NULL DEFAULT '{}';
-- shape: { "labels_reviewed": boolean, "matrix_reviewed": boolean }
