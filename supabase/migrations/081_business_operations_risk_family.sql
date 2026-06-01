-- ─── 081: Add Business Operations & Internal Data risk family ────────────────
-- Extends the CHECK constraint on both catalog_data_types and org_data_types
-- and assigns the 13 Internal Operations data types to the new risk family.

-- 1. Update CHECK constraint on catalog_data_types
DO $$
DECLARE v_con text;
BEGIN
  SELECT conname INTO v_con
  FROM pg_constraint
  WHERE conrelid = 'catalog_data_types'::regclass
    AND contype = 'c'
    AND conname ILIKE '%risk_family%';
  IF v_con IS NOT NULL THEN
    EXECUTE format('ALTER TABLE catalog_data_types DROP CONSTRAINT %I', v_con);
  END IF;
END $$;

ALTER TABLE catalog_data_types
  ADD CONSTRAINT catalog_data_types_risk_family_check
  CHECK (risk_family IN (
    'Credentials, Keys & Secrets',
    'Regulated Data',
    'Source Code',
    'Intellectual Property',
    'Security & Infrastructure Data',
    'Customer & Employee Data',
    'Financial & Commercial Data',
    'Legal & Contractual Data',
    'Business Operations & Internal Data',
    'Public & Low-Risk Data'
  ) OR risk_family IS NULL);

-- 2. Update CHECK constraint on org_data_types
DO $$
DECLARE v_con text;
BEGIN
  SELECT conname INTO v_con
  FROM pg_constraint
  WHERE conrelid = 'org_data_types'::regclass
    AND contype = 'c'
    AND conname ILIKE '%risk_family%';
  IF v_con IS NOT NULL THEN
    EXECUTE format('ALTER TABLE org_data_types DROP CONSTRAINT %I', v_con);
  END IF;
END $$;

ALTER TABLE org_data_types
  ADD CONSTRAINT org_data_types_risk_family_check
  CHECK (risk_family IN (
    'Credentials, Keys & Secrets',
    'Regulated Data',
    'Source Code',
    'Intellectual Property',
    'Security & Infrastructure Data',
    'Customer & Employee Data',
    'Financial & Commercial Data',
    'Legal & Contractual Data',
    'Business Operations & Internal Data',
    'Public & Low-Risk Data'
  ) OR risk_family IS NULL);

-- 3. Assign the 13 Internal Operations data types to the new risk family
UPDATE catalog_data_types
SET risk_family = 'Business Operations & Internal Data'
WHERE subcategory = 'Internal Operations'
  AND risk_family IS NULL;
