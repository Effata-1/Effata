-- Migration 028: add risk_level to catalog_destinations
-- risk_level = inherent DLP risk of the destination type (system-set, not org-editable)
-- trust_tag  = org's policy decision about trustworthiness (org-editable)
-- These are orthogonal: an org can approve a destination while it still carries high inherent risk.

ALTER TABLE catalog_destinations
  ADD COLUMN IF NOT EXISTS risk_level TEXT NOT NULL DEFAULT 'medium';

-- critical: data exfiltration is the primary or extremely likely outcome
UPDATE catalog_destinations SET risk_level = 'critical'
  WHERE subcategory IN ('ai_tools', 'file_transfer');

-- high: significant DLP risk — external sharing common by design
UPDATE catalog_destinations SET risk_level = 'high'
  WHERE subcategory IN ('social_media', 'developer_tools', 'data_integration', 'email');

-- low: primarily internal tooling — low exfil surface
UPDATE catalog_destinations SET risk_level = 'low'
  WHERE subcategory IN (
    'corporate_saas', 'security_tools', 'observability',
    'data_platform', 'itsm', 'legal_compliance', 'customer_success'
  );

-- medium (default): manageable risk with controls
-- covers: communication, collaboration, cloud_storage, marketing, finance_accounting,
--         hr_people, crm_sales, design_creative, ecommerce, web_publishing, unclassified
-- (already set by the DEFAULT 'medium' above — no explicit UPDATE needed)
