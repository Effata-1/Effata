-- Activate org_vendor_object_mappings (was a V2 placeholder in migration 069)
-- Rename effata_* columns to neutral_* for vendor-agnostic naming
-- Add purpose, quality, verification, not_applicable, and audit fields
-- Add updated_at trigger for reliable mapping version hashing

-- 1. Rename effata_* columns
ALTER TABLE org_vendor_object_mappings
  RENAME COLUMN effata_object_type TO neutral_object_type;
ALTER TABLE org_vendor_object_mappings
  RENAME COLUMN effata_object_key  TO neutral_object_key;

-- 2. Add new columns
ALTER TABLE org_vendor_object_mappings
  ADD COLUMN IF NOT EXISTS neutral_object_display_name TEXT,
  ADD COLUMN IF NOT EXISTS vendor_object_key            TEXT,
  ADD COLUMN IF NOT EXISTS vendor_console_path          TEXT,
  -- mapping_purpose: differentiates multiple vendor objects serving the same Effata concept.
  -- e.g. one app_category can map to a Netskope custom_category AND an app_instance_tag.
  -- policy_order: for Netskope policy ordering (allow/bypass before block).
  ADD COLUMN IF NOT EXISTS mapping_purpose TEXT NOT NULL DEFAULT 'destination_scope'
    CHECK (mapping_purpose IN (
      'destination_scope', 'detection_profile', 'notification',
      'exception', 'evidence', 'policy_order'
    )),
  ADD COLUMN IF NOT EXISTS mapping_quality TEXT NOT NULL DEFAULT 'unverified'
    CHECK (mapping_quality IN (
      'exact', 'lossy', 'customer_verified',
      'customer_mapping_required', 'not_applicable', 'unverified'
    )),
  ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN (
      'unverified', 'verified', 'needs_review', 'stale', 'invalid'
    )),
  ADD COLUMN IF NOT EXISTS is_active           BOOLEAN     NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS not_applicable      BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS not_applicable_reason TEXT,
  ADD COLUMN IF NOT EXISTS verified            BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verified_by         UUID        REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS verified_at         TIMESTAMPTZ,
  -- verification_note is required when verifying a lossy mapping (captures the accepted limitation)
  ADD COLUMN IF NOT EXISTS verification_note   TEXT;

-- 3. Drop old unique constraint (column was renamed)
ALTER TABLE org_vendor_object_mappings
  DROP CONSTRAINT IF EXISTS org_vendor_object_mappings_org_id_vendor_id_effata_object_type_key;

-- 4. Rebuild unique constraint:
--    one row per (org, vendor, neutral concept, vendor object type, purpose)
--    allows multiple Netskope objects to serve one Effata concept across different purposes
ALTER TABLE org_vendor_object_mappings
  ADD CONSTRAINT org_vendor_object_mappings_unique
    UNIQUE (org_id, vendor_id, neutral_object_type, neutral_object_key, vendor_object_type, mapping_purpose);

-- 5. updated_at trigger for reliable mapping version hash computation
CREATE OR REPLACE FUNCTION set_ovm_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ovm_set_updated_at ON org_vendor_object_mappings;
CREATE TRIGGER ovm_set_updated_at
  BEFORE UPDATE ON org_vendor_object_mappings
  FOR EACH ROW EXECUTE FUNCTION set_ovm_updated_at();

-- 6. Additional indexes for adapter lookup patterns
CREATE INDEX IF NOT EXISTS idx_ovm_org_vendor
  ON org_vendor_object_mappings (org_id, vendor_id);
CREATE INDEX IF NOT EXISTS idx_ovm_org_vendor_type
  ON org_vendor_object_mappings (org_id, vendor_id, neutral_object_type);
CREATE INDEX IF NOT EXISTS idx_ovm_vendor_obj_type
  ON org_vendor_object_mappings (org_id, vendor_id, vendor_object_type);

-- 7. Extend org_vendor_translations with customer_mapping_version and translated_at
--    (adapter_version already exists from migration 069)
ALTER TABLE org_vendor_translations
  ADD COLUMN IF NOT EXISTS customer_mapping_version TEXT,
  ADD COLUMN IF NOT EXISTS translated_at            TIMESTAMPTZ;

-- Backfill translated_at for existing rows
UPDATE org_vendor_translations
  SET translated_at = updated_at
  WHERE translated_at IS NULL;
