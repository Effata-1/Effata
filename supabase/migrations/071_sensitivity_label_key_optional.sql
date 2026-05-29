-- Migration 071: Make label_key optional on org_customer_sensitivity_labels
-- Some customers do not want to expose their MIP/TITUS metadata key attribute names.
-- Storing NULL when the key is not provided, so multiple labels without a key don't conflict.

-- Drop the existing full unique constraint (covers empty strings, which collide)
ALTER TABLE org_customer_sensitivity_labels DROP CONSTRAINT IF EXISTS org_customer_sensitivity_labels_org_id_label_key_key;

-- Make label_key nullable
ALTER TABLE org_customer_sensitivity_labels ALTER COLUMN label_key DROP NOT NULL;

-- Replace with a partial unique index: uniqueness only applies when label_key is provided
CREATE UNIQUE INDEX IF NOT EXISTS idx_org_customer_sensitivity_labels_key
  ON org_customer_sensitivity_labels(org_id, label_key)
  WHERE label_key IS NOT NULL;
