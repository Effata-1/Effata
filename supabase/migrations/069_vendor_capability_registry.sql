-- System-wide vendor capability registry (no org_id — managed by Effata, not per-org)
CREATE TABLE vendor_capability_registries (
  id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id  TEXT    NOT NULL UNIQUE,
  version    TEXT    NOT NULL DEFAULT '2025-01',
  features   JSONB   NOT NULL DEFAULT '{}',
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- No RLS — read-only for authenticated, full access for service_role
GRANT SELECT ON TABLE public.vendor_capability_registries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.vendor_capability_registries TO service_role;

-- Per-org, per-policy, per-vendor translation results
-- Source of truth for vendor translation state; policy-level vendor_translation_status is an aggregate summary only
CREATE TABLE org_vendor_translations (
  id                          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                      UUID    NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  policy_id                   UUID    NOT NULL REFERENCES org_genai_policies(id) ON DELETE CASCADE,
  vendor_id                   TEXT    NOT NULL,
  status                      TEXT    NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','translating','translated','partial','verified','deferred','error')),
  -- partial = translated but mapping_report contains lossy or unverified items (honest quality signal)
  adapter_version             TEXT,           -- semver of the adapter at time of translation (detect stale output)
  capability_registry_version TEXT,           -- version field from vendor_capability_registries row used
  neutral_policy_hash         TEXT,           -- SHA-256 of stable policy fields; mismatch = policy changed since last translation
  native_policies             JSONB   NOT NULL DEFAULT '[]',
  mapping_report              JSONB   NOT NULL DEFAULT '{}',
  reviewed_by                 UUID    REFERENCES profiles(id),
  reviewed_at                 TIMESTAMPTZ,
  exported_at                 TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, policy_id, vendor_id)
);
ALTER TABLE org_vendor_translations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_isolation" ON org_vendor_translations
  USING (org_id = (auth.jwt() ->> 'org_id')::uuid);
-- authenticated = SELECT only; writes go through server actions using service_role
GRANT SELECT ON TABLE public.org_vendor_translations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.org_vendor_translations TO service_role;

-- Placeholder for V2: maps Effata objects to customer's vendor-specific objects
-- e.g. "Restricted / Unassessed" governance category → Netskope custom app category "Shadow AI Apps"
-- Adapters in V1 generate generic output; V2 will enrich with these customer-specific mappings
CREATE TABLE org_vendor_object_mappings (
  id                  UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID    NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  vendor_id           TEXT    NOT NULL,
  effata_object_type  TEXT    NOT NULL,  -- 'governance_category' | 'data_label' | 'coaching_template' | 'user_group'
  effata_object_key   TEXT    NOT NULL,  -- category id, 'secret', coaching_template id, etc.
  vendor_object_type  TEXT    NOT NULL,  -- 'app_category' | 'dlp_profile' | 'user_notification' | 'user_group'
  vendor_object_name  TEXT    NOT NULL,
  vendor_object_id    TEXT,              -- vendor-side identifier (null until the customer provides it)
  metadata            JSONB   DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, vendor_id, effata_object_type, effata_object_key)
);
ALTER TABLE org_vendor_object_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_isolation" ON org_vendor_object_mappings
  USING (org_id = (auth.jwt() ->> 'org_id')::uuid);
GRANT SELECT, INSERT, UPDATE ON TABLE public.org_vendor_object_mappings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.org_vendor_object_mappings TO service_role;

-- Add CHECK constraint to existing vendor_translation_status column (was unconstrained in migration 052)
-- Adds 'partial' to reflect policies where some vendors succeeded but others had lossy/split translations
ALTER TABLE org_genai_policies
  ADD CONSTRAINT org_genai_policies_vendor_translation_status_check
    CHECK (vendor_translation_status IN ('pending','translated','partial','verified','not-applicable'));

-- Seed first-wave vendor capability registries
-- Features use three levels: 'native' | 'partial' | 'unverified'
-- policy_split_required: true = one neutral policy maps to multiple native policies in this vendor
INSERT INTO vendor_capability_registries (vendor_id, version, features) VALUES

('netskope', '2025-01', '{
  "supports_app_instance_scope": "native",
  "supports_sensitivity_label_condition": "partial",
  "supports_edm": "native",
  "supports_endpoint": "native",
  "supports_email": "unverified",
  "supports_genai_inline": "native",
  "supports_genai_api": "native",
  "supports_block_coaching": "native",
  "supports_exceptions_rule_groups": "partial",
  "supports_activity_controls": "native",
  "supports_api_saas_at_rest": "native",
  "policy_split_required": false
}'),

('microsoft-purview', '2025-01', '{
  "supports_app_instance_scope": "partial",
  "supports_sensitivity_label_condition": "native",
  "supports_edm": "native",
  "supports_endpoint": "native",
  "supports_email": "native",
  "supports_genai_inline": "partial",
  "supports_genai_api": "partial",
  "supports_block_coaching": "partial",
  "supports_exceptions_rule_groups": "partial",
  "supports_activity_controls": "partial",
  "supports_api_saas_at_rest": "native",
  "policy_split_required": true
}'),

('forcepoint-dlp', '2025-01', '{
  "supports_app_instance_scope": "partial",
  "supports_sensitivity_label_condition": "partial",
  "supports_edm": "native",
  "supports_endpoint": "native",
  "supports_email": "native",
  "supports_genai_inline": "native",
  "supports_genai_api": "partial",
  "supports_block_coaching": "native",
  "supports_exceptions_rule_groups": "native",
  "supports_activity_controls": "native",
  "supports_api_saas_at_rest": "partial",
  "policy_split_required": false
}'),

('skyhigh-security', '2025-01', '{
  "supports_app_instance_scope": "native",
  "supports_sensitivity_label_condition": "native",
  "supports_edm": "native",
  "supports_endpoint": "unverified",
  "supports_email": "partial",
  "supports_genai_inline": "native",
  "supports_genai_api": "native",
  "supports_block_coaching": "partial",
  "supports_exceptions_rule_groups": "native",
  "supports_activity_controls": "native",
  "supports_api_saas_at_rest": "native",
  "policy_split_required": true
}');
