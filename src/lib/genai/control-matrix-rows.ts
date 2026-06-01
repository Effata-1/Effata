// Shared constants for the GenAI Control Matrix.
// No 'use client' — importable by both client components and server actions.

// ── Display name → stable rfKey slug ─────────────────────────────────────────
// rfKey values become policy_key suffixes (e.g. 'rf:credentials_keys_secrets').
// Never rename an existing rfKey — it would orphan DB rows.

export const RF_KEY: Record<string, string> = {
  'Credentials, Keys & Secrets':    'credentials_keys_secrets',
  'Regulated Data':                 'regulated_data',
  'Source Code':                    'source_code',
  'Intellectual Property':          'intellectual_property',
  'Customer & Employee Data':       'customer_employee_data',
  'Financial & Commercial Data':    'financial_commercial_data',
  'Legal & Contractual Data':       'legal_contractual_data',
  'Security & Infrastructure Data': 'security_infrastructure_data',
  'Public & Low-Risk Data':         'public_low_risk_data',
  'Bulk Data / Large Dataset':      'bulk_data',
  'Large File Upload':              'large_file_upload',
  'General Usage Reminder':         'general_usage_reminder',
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
    credentials_keys_secrets:     'block',
    regulated_data:               'alert',
    source_code:                  'alert',
    intellectual_property:        'alert',
    customer_employee_data:       'allow',
    financial_commercial_data:    'allow',
    legal_contractual_data:       'allow',
    security_infrastructure_data: 'alert',
    public_low_risk_data:         'allow',
    bulk_data:                    'allow',
    large_file_upload:            'allow',
    general_usage_reminder:       'allow',
  },
  approved_with_conditions: {
    credentials_keys_secrets:     'block',
    regulated_data:               'block',
    source_code:                  'block',
    intellectual_property:        'block',
    customer_employee_data:       'coach-just',
    financial_commercial_data:    'coach-just',
    legal_contractual_data:       'coach-just',
    security_infrastructure_data: 'block',
    public_low_risk_data:         'allow',
    bulk_data:                    'coach-just',
    large_file_upload:            'coach-just',
    general_usage_reminder:       'coach-ack',
  },
  restricted_unassessed: {
    credentials_keys_secrets:     'block',
    regulated_data:               'block',
    source_code:                  'block',
    intellectual_property:        'block',
    customer_employee_data:       'block',
    financial_commercial_data:    'block',
    legal_contractual_data:       'block',
    security_infrastructure_data: 'block',
    public_low_risk_data:         'allow',
    bulk_data:                    'block',
    large_file_upload:            'block',
    general_usage_reminder:       'coach-ack',
  },
  prohibited: {
    credentials_keys_secrets:     'block',
    regulated_data:               'block',
    source_code:                  'block',
    intellectual_property:        'block',
    customer_employee_data:       'block',
    financial_commercial_data:    'block',
    legal_contractual_data:       'block',
    security_infrastructure_data: 'block',
    public_low_risk_data:         'block',
    bulk_data:                    'block',
    large_file_upload:            'block',
    general_usage_reminder:       'block',
  },
}

// ── RF_COACHING_DEFAULTS: default coaching notification name per cell ─────────

export const RF_COACHING_DEFAULTS: Record<string, Partial<Record<string, string | null>>> = {
  approved_supported: {
    credentials_keys_secrets:     'Credential Sharing Blocked',
    regulated_data:               null,
    source_code:                  null,
    intellectual_property:        null,
    customer_employee_data:       null,
    financial_commercial_data:    null,
    legal_contractual_data:       null,
    security_infrastructure_data: null,
    public_low_risk_data:         null,
    bulk_data:                    null,
    large_file_upload:            null,
    general_usage_reminder:       null,
  },
  approved_with_conditions: {
    credentials_keys_secrets:     'Credential Sharing Blocked',
    regulated_data:               'Regulated Data Detected',
    source_code:                  'Source Code or Intellectual Property Detected',
    intellectual_property:        'Source Code or Intellectual Property Detected',
    customer_employee_data:       'Regulated Data Detected',
    financial_commercial_data:    'Regulated Data Detected',
    legal_contractual_data:       'Classified Data Detected',
    security_infrastructure_data: 'Sensitive Data Blocked',
    public_low_risk_data:         null,
    bulk_data:                    'Bulk Data Sharing Detected',
    large_file_upload:            'Large File Upload Blocked',
    general_usage_reminder:       'GenAI Usage Reminder',
  },
  restricted_unassessed: {
    credentials_keys_secrets:     'Credential Sharing Blocked',
    regulated_data:               'Regulated Data Detected',
    source_code:                  'Source Code or Intellectual Property Detected',
    intellectual_property:        'Source Code or Intellectual Property Detected',
    customer_employee_data:       'Regulated Data Detected',
    financial_commercial_data:    'Regulated Data Detected',
    legal_contractual_data:       'Classified Data Detected',
    security_infrastructure_data: 'Sensitive Data Blocked',
    public_low_risk_data:         null,
    bulk_data:                    'Bulk Data Sharing Detected',
    large_file_upload:            'Large File Upload Blocked',
    general_usage_reminder:       'GenAI Usage Reminder',
  },
  prohibited: {
    credentials_keys_secrets:     'GenAI Application Blocked',
    regulated_data:               'GenAI Application Blocked',
    source_code:                  'GenAI Application Blocked',
    intellectual_property:        'GenAI Application Blocked',
    customer_employee_data:       'GenAI Application Blocked',
    financial_commercial_data:    'GenAI Application Blocked',
    legal_contractual_data:       'GenAI Application Blocked',
    security_infrastructure_data: 'GenAI Application Blocked',
    public_low_risk_data:         'GenAI Application Blocked',
    bulk_data:                    'GenAI Application Blocked',
    large_file_upload:            'GenAI Application Blocked',
    general_usage_reminder:       'GenAI Application Blocked',
  },
}
