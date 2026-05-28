-- Rename default GenAI governance category display names.
-- Only updates rows where the name still matches the old default (preserves custom names).

UPDATE org_genai_governance_categories
SET name = 'Approved & Supported'
WHERE system_tag = 'enterprise-approved'
  AND name IN ('Approved & Supported GenAI', 'Enterprise Approved');

UPDATE org_genai_governance_categories
SET name = 'Approved with Conditions'
WHERE system_tag = 'approved-with-conditions'
  AND name IN ('Approved with Conditions');

UPDATE org_genai_governance_categories
SET name = 'Restricted / Unassessed'
WHERE system_tag = 'permitted-with-restriction'
  AND name IN ('Restricted / Unassessed GenAI', 'Permitted with Restriction', 'Restricted / Unassessed GenAI');

UPDATE org_genai_governance_categories
SET name = 'Prohibited'
WHERE system_tag = 'prohibited'
  AND name IN ('Prohibited GenAI', 'Prohibited');
