-- Add vendor_mapping_report to org_genai_policies
-- Stores the latest Netskope mapping_report for quick display without joining org_vendor_translations

ALTER TABLE org_genai_policies
  ADD COLUMN IF NOT EXISTS vendor_mapping_report JSONB NOT NULL DEFAULT '{}';
