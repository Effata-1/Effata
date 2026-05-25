-- Remove the Personal GenAI Instance governance category.
-- Apps previously classified as 'personal' are moved to 'permitted-with-restriction'.

-- Reclassify any app-level classifications from 'personal' → 'permitted-with-restriction'
UPDATE genai_customer_classifications
SET customer_classification = 'permitted-with-restriction',
    updated_at              = now()
WHERE customer_classification = 'personal';

-- Deactivate (rather than delete) so historical FK references remain intact
UPDATE org_genai_governance_categories
SET active = false
WHERE system_tag = 'personal';
