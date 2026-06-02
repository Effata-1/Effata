// Shared constants for the GenAI Control Matrix.
// No 'use client' — importable by both client components and server actions.

import { RISK_FAMILIES } from '@/lib/shared/risk-families'

// ── Display name → stable rfKey slug ─────────────────────────────────────────
// rfKey values become policy_key suffixes (e.g. 'rf:credentials_keys_secrets').
// Never rename an existing rfKey — it would orphan DB rows.
// The 10 shared risk families are derived from the single source of truth.

export const RF_KEY: Record<string, string> = {
  // 10 shared entries — derived from src/lib/shared/risk-families.ts
  ...Object.fromEntries(RISK_FAMILIES.map(rf => [rf.label, rf.id])),
  // 3 GenAI-only rows — no data catalog equivalent
  'Bulk Data / Large Dataset': 'bulk_data',
  'Large File Upload':         'large_file_upload',
  'General Usage Reminder':    'general_usage_reminder',
}

// ── Matrix row order — source of truth for both UI and recommended policies ───
// Adding a row here (+ a matching RF_KEY entry) automatically creates a new
// recommended policy on the next syncRecommendedPolicies() call.

export const CONTENT_DETECTION_ROWS = [
  'Credentials, Keys & Secrets',
  'Regulated Data',
  'Source Code',
  'Intellectual Property',
  'Security & Infrastructure Data',
  'Customer & Employee Data',
  'Financial & Commercial Data',
  'Legal & Contractual Data',
  'Business Operations & Internal Data',
  'Bulk Data / Large Dataset',
  'Large File Upload',
  'General Usage Reminder',
  'Public & Low-Risk Data',
] as const

export type ContentDetectionRow = typeof CONTENT_DETECTION_ROWS[number]

// ── DB system_tag → internal key alias ───────────────────────────────────────

export const TAG_ALIAS: Record<string, string> = {
  // Old DB system_tags (legacy naming)
  'enterprise-approved':        'approved_supported',
  'approved-with-conditions':   'approved_with_conditions',
  'permitted-with-restriction': 'restricted_unassessed',
  'prohibited':                 'prohibited',
  // Current internal keys resolve to themselves
  'approved_supported':         'approved_supported',
  'approved_with_conditions':   'approved_with_conditions',
  'restricted_unassessed':      'restricted_unassessed',
}

// ── Product-facing display names for system categories ───────────────────────

export const TAG_DISPLAY_NAMES: Record<string, string> = {
  'enterprise-approved':        'Approved & Supported GenAI',
  'approved-with-conditions':   'Approved with Conditions',
  'permitted-with-restriction': 'Restricted / Unassessed GenAI',
  'prohibited':                 'Prohibited GenAI',
  'approved_supported':         'Approved & Supported GenAI',
  'approved_with_conditions':   'Approved with Conditions',
  'restricted_unassessed':      'Restricted / Unassessed GenAI',
}

// ── RF_DEFAULTS: default action per (governance category × risk family) ───────

export const RF_DEFAULTS: Record<string, Partial<Record<string, string>>> = {
  approved_supported: {
    credentials_keys_secrets:          'block',
    regulated_data:                    'alert',
    source_code:                       'alert',
    intellectual_property:             'alert',
    customer_employee_data:            'allow',
    financial_commercial_data:         'allow',
    legal_contractual_data:            'allow',
    security_infrastructure_data:      'alert',
    business_operations_internal_data: 'allow',
    public_low_risk_data:              'allow',
    bulk_data:                         'allow',
    large_file_upload:                 'allow',
    general_usage_reminder:            'allow',
  },
  approved_with_conditions: {
    credentials_keys_secrets:          'block',
    regulated_data:                    'block',
    source_code:                       'block',
    intellectual_property:             'block',
    customer_employee_data:            'coach-just',
    financial_commercial_data:         'coach-just',
    legal_contractual_data:            'coach-just',
    security_infrastructure_data:      'block',
    business_operations_internal_data: 'coach-just',
    public_low_risk_data:              'allow',
    bulk_data:                         'coach-just',
    large_file_upload:                 'coach-just',
    general_usage_reminder:            'coach-ack',
  },
  restricted_unassessed: {
    credentials_keys_secrets:          'block',
    regulated_data:                    'block',
    source_code:                       'block',
    intellectual_property:             'block',
    customer_employee_data:            'block',
    financial_commercial_data:         'block',
    legal_contractual_data:            'block',
    security_infrastructure_data:      'block',
    business_operations_internal_data: 'block',
    public_low_risk_data:              'allow',
    bulk_data:                         'block',
    large_file_upload:                 'block',
    general_usage_reminder:            'coach-ack',
  },
  prohibited: {
    credentials_keys_secrets:          'block',
    regulated_data:                    'block',
    source_code:                       'block',
    intellectual_property:             'block',
    customer_employee_data:            'block',
    financial_commercial_data:         'block',
    legal_contractual_data:            'block',
    security_infrastructure_data:      'block',
    business_operations_internal_data: 'block',
    public_low_risk_data:              'block',
    bulk_data:                         'block',
    large_file_upload:                 'block',
    general_usage_reminder:            'block',
  },
}

// ── Filename detection levels — only Highly Confidential and Secret trigger ───

export const FILENAME_DETECTION_LEVELS = ['highly_confidential', 'secret'] as const
export type FilenameDetectionLevel = typeof FILENAME_DETECTION_LEVELS[number]

// Upload — Filename Detection defaults (internal keys, consistent with RF_DEFAULTS)
export const UL_FN_DEFAULTS: Record<string, Partial<Record<string, string>>> = {
  approved_supported:       { highly_confidential: 'allow',     secret: 'allow' },
  approved_with_conditions: { highly_confidential: 'coach-ack', secret: 'coach-just' },
  restricted_unassessed:    { highly_confidential: 'block',     secret: 'block' },
  prohibited:               { highly_confidential: 'block',     secret: 'block' },
}

// Upload — Data Classification Label Detection defaults (internal keys)
export const UL_DC_DEFAULTS: Record<string, Partial<Record<string, string>>> = {
  approved_supported:       { public: 'allow',   internal: 'monitor', confidential: 'alert',  highly_confidential: 'coach-ack', secret: 'block' },
  approved_with_conditions: { public: 'allow',   internal: 'monitor', confidential: 'coach-ack', highly_confidential: 'block',  secret: 'block' },
  restricted_unassessed:    { public: 'monitor', internal: 'coach-ack', confidential: 'block', highly_confidential: 'block',   secret: 'block' },
  prohibited:               { public: 'block',   internal: 'block',   confidential: 'block',  highly_confidential: 'block',     secret: 'block' },
}

// ── RF_COACHING_DEFAULTS: default coaching notification name per cell ─────────
// Rule: template name must be compatible with the action in RF_DEFAULTS.
//   block     → "... Blocked" templates only
//   coach-just → "... Detected" (justification) or "... Justification Required" templates
//   coach-ack  → "... Detected" (acknowledgement) templates
//   allow/alert → null

export const RF_COACHING_DEFAULTS: Record<string, Partial<Record<string, string | null>>> = {
  approved_supported: {
    credentials_keys_secrets:          'Credential Sharing Blocked',      // block ✓
    regulated_data:                    null,                               // alert
    source_code:                       null,                               // alert
    intellectual_property:             null,                               // alert
    customer_employee_data:            null,                               // allow
    financial_commercial_data:         null,                               // allow
    legal_contractual_data:            null,                               // allow
    security_infrastructure_data:      null,                               // alert
    business_operations_internal_data: null,                               // allow
    public_low_risk_data:              null,                               // allow
    bulk_data:                         null,                               // allow
    large_file_upload:                 null,                               // allow
    general_usage_reminder:            null,                               // allow
  },
  approved_with_conditions: {
    credentials_keys_secrets:          'Credential Sharing Blocked',       // block ✓
    regulated_data:                    'Regulated Data Blocked',            // block ✓ (was Detected)
    source_code:                       'Source Code or IP Blocked',         // block ✓ (was Detected)
    intellectual_property:             'Intellectual Property Blocked',     // block ✓ (was Detected)
    customer_employee_data:            'Regulated Data Detected',           // coach-just ✓
    financial_commercial_data:         'Financial Data Justification Required', // coach-just ✓ (was Detected)
    legal_contractual_data:            'Legal Data Justification Required', // coach-just ✓ (was Classified Data Detected)
    security_infrastructure_data:      'Sensitive Data Blocked',            // block ✓
    business_operations_internal_data: 'Business Justification Required',   // coach-just ✓
    public_low_risk_data:              null,                                // allow
    bulk_data:                         'Bulk Data Sharing Detected',        // coach-just ✓
    large_file_upload:                 'Large File Upload Justification Required', // coach-just ✓ (was Blocked)
    general_usage_reminder:            'GenAI Usage Reminder',              // coach-ack ✓
  },
  restricted_unassessed: {
    credentials_keys_secrets:          'Credential Sharing Blocked',        // block ✓
    regulated_data:                    'Regulated Data Blocked',             // block ✓ (was Detected)
    source_code:                       'Source Code or IP Blocked',          // block ✓ (was Detected)
    intellectual_property:             'Intellectual Property Blocked',      // block ✓ (was Detected)
    customer_employee_data:            'Regulated Data Blocked',             // block ✓ (was Detected)
    financial_commercial_data:         'Financial Data Blocked',             // block ✓ (was Detected)
    legal_contractual_data:            'Legal Data Blocked',                 // block ✓ (was Detected)
    security_infrastructure_data:      'Sensitive Data Blocked',             // block ✓
    business_operations_internal_data: 'Internal Business Data Blocked',     // block ✓
    public_low_risk_data:              null,                                 // allow
    bulk_data:                         'Bulk Data Sharing Blocked',          // block ✓ (was Detected)
    large_file_upload:                 'Large File Upload Blocked',          // block ✓
    general_usage_reminder:            'GenAI Usage Reminder',               // coach-ack ✓
  },
  prohibited: {
    // Prohibited is excluded from content detection policies (access_posture = block).
    // These entries exist as a reference but are never applied in syncRecommendedPolicies.
    credentials_keys_secrets:          'GenAI Application Blocked',
    regulated_data:                    'GenAI Application Blocked',
    source_code:                       'GenAI Application Blocked',
    intellectual_property:             'GenAI Application Blocked',
    customer_employee_data:            'GenAI Application Blocked',
    financial_commercial_data:         'GenAI Application Blocked',
    legal_contractual_data:            'GenAI Application Blocked',
    security_infrastructure_data:      'GenAI Application Blocked',
    business_operations_internal_data: 'GenAI Application Blocked',
    public_low_risk_data:              'GenAI Application Blocked',
    bulk_data:                         'GenAI Application Blocked',
    large_file_upload:                 'GenAI Application Blocked',
    general_usage_reminder:            'GenAI Application Blocked',
  },
}

// ── UL_FN_COACHING_DEFAULTS: filename detection coaching per (catTag × sysLevel) ─
// Restructured from 1D (level-only) to 2D (category × level) to allow different
// templates for coach-ack (Approved with Conditions) vs block (Restricted).

export const UL_FN_COACHING_DEFAULTS: Record<string, Partial<Record<string, string | null>>> = {
  approved_supported: {
    highly_confidential: null,    // allow — no template
    secret:              null,    // allow — no template
  },
  approved_with_conditions: {
    highly_confidential: 'Sensitive File Name Detected',             // coach-ack ✓
    secret:              'Sensitive Filename Justification Required', // coach-just ✓
  },
  restricted_unassessed: {
    highly_confidential: 'Highly Confidential Upload Blocked',       // block ✓
    secret:              'Secret File Upload Blocked',                // block ✓
  },
}

// ── UL_DC_COACHING_DEFAULTS: label detection coaching per (catTag × sysLevel) ──
// Parallel to UL_DC_DEFAULTS. Previously all null (Loop 3 hardcoded null).

export const UL_DC_COACHING_DEFAULTS: Record<string, Partial<Record<string, string | null>>> = {
  approved_supported: {
    public:              null,                      // allow
    internal:            null,                      // monitor
    confidential:        null,                      // alert
    highly_confidential: 'Classified Data Detected', // coach-ack ✓
    secret:              'Secret Data Blocked',       // block ✓
  },
  approved_with_conditions: {
    public:              null,                       // allow
    internal:            null,                       // monitor
    confidential:        'Classified Data Detected',  // coach-ack ✓
    highly_confidential: 'Classified Data Blocked',   // block ✓
    secret:              'Secret Data Blocked',        // block ✓
  },
  restricted_unassessed: {
    public:              null,                              // monitor
    internal:            'Restricted or Unassessed GenAI',  // coach-ack ✓
    confidential:        'Classified Data Blocked',          // block ✓
    highly_confidential: 'Classified Data Blocked',          // block ✓
    secret:              'Secret Data Blocked',               // block ✓
  },
}
