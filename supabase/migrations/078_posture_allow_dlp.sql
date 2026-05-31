-- Add 'allow_dlp' to access_posture: users can reach apps but DLP controls are enforced.
-- Previously only 'allow' and 'block' existed; 'allow_dlp' sits between them.
-- All categories except Prohibited default to Allow + DLP Controls.

ALTER TABLE org_genai_governance_categories
  DROP CONSTRAINT IF EXISTS org_genai_governance_categories_access_posture_check;

ALTER TABLE org_genai_governance_categories
  ADD CONSTRAINT org_genai_governance_categories_access_posture_check
  CHECK (access_posture IN ('allow', 'allow_dlp', 'block'));

-- Set ALL non-prohibited categories to allow_dlp (including Approved & Supported).
UPDATE org_genai_governance_categories
  SET access_posture = 'allow_dlp'
  WHERE (system_tag IS NULL OR system_tag != 'prohibited')
    AND access_posture = 'allow';

-- New categories default to allow_dlp going forward.
ALTER TABLE org_genai_governance_categories
  ALTER COLUMN access_posture SET DEFAULT 'allow_dlp';
