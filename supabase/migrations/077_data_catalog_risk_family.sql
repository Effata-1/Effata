-- ─────────────────────────────────────────────────────────────────────────────
-- 077_data_catalog_risk_family.sql
-- Adds risk_family to catalog_data_types and org_data_types.
-- Risk Family answers "which policy pack should protect this data?"
-- complementing Effata Sensitivity Level ("how strict should the control be?").
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── catalog_data_types ──────────────────────────────────────────────────────

ALTER TABLE catalog_data_types
  ADD COLUMN IF NOT EXISTS risk_family TEXT;

ALTER TABLE catalog_data_types
  ADD CONSTRAINT catalog_data_types_risk_family_check
  CHECK (
    risk_family IS NULL OR risk_family IN (
      'Credentials, Keys & Secrets',
      'Regulated Data',
      'Source Code',
      'Intellectual Property',
      'Customer & Employee Data',
      'Financial & Commercial Data',
      'Legal & Contractual Data',
      'Security & Infrastructure Data',
      'Public & Low-Risk Data'
    )
  );

CREATE INDEX IF NOT EXISTS idx_catalog_data_types_risk_family
  ON catalog_data_types (risk_family);

UPDATE catalog_data_types SET risk_family = CASE subcategory
  WHEN 'Credentials and Authentication Data'              THEN 'Credentials, Keys & Secrets'
  WHEN 'API Keys, Tokens, and Secrets'                    THEN 'Credentials, Keys & Secrets'
  WHEN 'Cryptographic and Key Material'                   THEN 'Credentials, Keys & Secrets'
  WHEN 'High-Risk Certificate and Secret Files'           THEN 'Credentials, Keys & Secrets'
  WHEN 'Privileged Access and Administrative Data'        THEN 'Credentials, Keys & Secrets'
  WHEN 'Critical Security Data'                           THEN 'Security & Infrastructure Data'
  WHEN 'Executive, Board, M&A, and Market-Sensitive Data' THEN 'Financial & Commercial Data'
  WHEN 'Crown-Jewel Intellectual Property'                THEN 'Intellectual Property'
  WHEN 'Personal and Identity Data'                       THEN 'Regulated Data'
  WHEN 'Sensitive Personal Data'                          THEN 'Regulated Data'
  WHEN 'Payment and Financial Sensitive Data'             THEN 'Regulated Data'
  WHEN 'HR and Employee Sensitive Data'                   THEN 'Customer & Employee Data'
  WHEN 'Customer-Sensitive Data'                          THEN 'Customer & Employee Data'
  WHEN 'Legal and Compliance Sensitive Data'              THEN 'Legal & Contractual Data'
  WHEN 'Security-Sensitive Data'                          THEN 'Security & Infrastructure Data'
  WHEN 'Source Code and Engineering Data'                 THEN 'Source Code'
  WHEN 'Intellectual Property and Research Data'          THEN 'Intellectual Property'
  WHEN 'Operationally Sensitive Data'                     THEN 'Security & Infrastructure Data'
  WHEN 'Customer Business Data'                           THEN 'Customer & Employee Data'
  WHEN 'Contractual Data'                                 THEN 'Legal & Contractual Data'
  WHEN 'Commercial Data'                                  THEN 'Financial & Commercial Data'
  WHEN 'Vendor and Procurement Data'                      THEN 'Financial & Commercial Data'
  WHEN 'Product and Strategy Data'                        THEN 'Intellectual Property'
  WHEN 'Project Delivery Data'                            THEN 'Intellectual Property'
  WHEN 'Internal Financial Data'                          THEN 'Financial & Commercial Data'
  WHEN 'Business Risk Data'                               THEN 'Security & Infrastructure Data'
  WHEN 'Public Content'                                   THEN 'Public & Low-Risk Data'
  ELSE NULL
END;

-- ─── org_data_types (custom data types created by orgs) ──────────────────────

ALTER TABLE org_data_types
  ADD COLUMN IF NOT EXISTS risk_family TEXT;

ALTER TABLE org_data_types
  ADD CONSTRAINT org_data_types_risk_family_check
  CHECK (
    risk_family IS NULL OR risk_family IN (
      'Credentials, Keys & Secrets',
      'Regulated Data',
      'Source Code',
      'Intellectual Property',
      'Customer & Employee Data',
      'Financial & Commercial Data',
      'Legal & Contractual Data',
      'Security & Infrastructure Data',
      'Public & Low-Risk Data'
    )
  );
