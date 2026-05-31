-- Add 'allow_dlp' to access_posture: users can reach apps but DLP controls are enforced.
-- Previously only 'allow' and 'block' existed; 'allow_dlp' sits between them.
-- approved-with-conditions and permitted-with-restriction default to this new state.

ALTER TABLE org_genai_governance_categories
  DROP CONSTRAINT IF EXISTS org_genai_governance_categories_access_posture_check;

ALTER TABLE org_genai_governance_categories
  ADD CONSTRAINT org_genai_governance_categories_access_posture_check
  CHECK (access_posture IN ('allow', 'allow_dlp', 'block'));

-- Set system categories 2 & 3 to allow_dlp; enterprise-approved stays allow; prohibited stays block.
UPDATE org_genai_governance_categories
  SET access_posture = 'allow_dlp'
  WHERE system_tag IN ('approved-with-conditions', 'permitted-with-restriction')
    AND access_posture = 'allow';

-- Also set any existing custom categories (is_system = false) to allow_dlp.
UPDATE org_genai_governance_categories
  SET access_posture = 'allow_dlp'
  WHERE is_system = false
    AND access_posture = 'allow';

-- New custom categories default to allow_dlp going forward.
ALTER TABLE org_genai_governance_categories
  ALTER COLUMN access_posture SET DEFAULT 'allow_dlp';
