-- Remove enterprise profiles — one personal profile per app going forward
DELETE FROM genai_app_profiles WHERE mode = 'enterprise';

-- Prevent future enterprise rows
ALTER TABLE genai_app_profiles
  DROP CONSTRAINT IF EXISTS genai_app_profiles_mode_check;
ALTER TABLE genai_app_profiles
  ADD CONSTRAINT genai_app_profiles_mode_check CHECK (mode IN ('personal'));
