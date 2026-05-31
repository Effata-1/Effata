// Predefined GenAI policies — one per Risk Family row in the Control Matrix.
// Each NPJ encodes all 4 governance category decisions via actions_by_category
// and coaching_by_category (extra top-level fields; ignored by the validator).
// decision.mode is the most protective fallback for unclassified apps.

export interface PredefinedRFPolicy {
  policy_key:  string
  name:        string
  description: string
  risk_family: string
  rfKey:       string
  npj:         Record<string, unknown>
}

export const PREDEFINED_RF_POLICIES: PredefinedRFPolicy[] = [
  {
    policy_key:  'rf:credentials_keys_secrets',
    name:        'GenAI - Credential Sharing Block',
    description: 'Blocks credentials, API keys, and secrets from being submitted to any GenAI app across all trust levels.',
    risk_family: 'Credentials, Keys & Secrets',
    rfKey:       'credentials_keys_secrets',
    npj: {
      schema_version: '1.0',
      intent:         'prevent_exfiltration',
      policy_family:  'genai_content_detection',
      scope:   { activities: ['prompt_submit', 'upload'] },
      content: { operator: 'any', conditions: [{ type: 'data_type', risk_family: 'credentials_keys_secrets' }] },
      decision: { mode: 'block', require_acknowledgement: false, require_justification: false },
      actions_by_category: {
        approved_supported: 'block', approved_with_conditions: 'block',
        restricted_unassessed: 'block', prohibited: 'block',
      },
      coaching_by_category: {
        approved_supported: 'Credential Sharing Blocked', approved_with_conditions: 'Credential Sharing Blocked',
        restricted_unassessed: 'Credential Sharing Blocked', prohibited: 'GenAI Application Blocked',
      },
    },
  },
  {
    policy_key:  'rf:regulated_data',
    name:        'GenAI - Regulated Data Control',
    description: 'Alerts on regulated data (PII, PHI, PCI) for approved apps; blocks for all others.',
    risk_family: 'Regulated Data',
    rfKey:       'regulated_data',
    npj: {
      schema_version: '1.0',
      intent:         'prevent_exfiltration',
      policy_family:  'genai_content_detection',
      scope:   { activities: ['prompt_submit', 'upload'] },
      content: { operator: 'any', conditions: [{ type: 'data_type', risk_family: 'regulated_data' }] },
      decision: { mode: 'block', require_acknowledgement: false, require_justification: false },
      actions_by_category: {
        approved_supported: 'alert', approved_with_conditions: 'block',
        restricted_unassessed: 'block', prohibited: 'block',
      },
      coaching_by_category: {
        approved_supported: null, approved_with_conditions: 'Regulated Data Detected',
        restricted_unassessed: 'Regulated Data Detected', prohibited: 'GenAI Application Blocked',
      },
    },
  },
  {
    policy_key:  'rf:source_code',
    name:        'GenAI - Source Code Control',
    description: 'Alerts on source code for fully approved apps; blocks for all others.',
    risk_family: 'Source Code',
    rfKey:       'source_code',
    npj: {
      schema_version: '1.0',
      intent:         'prevent_exfiltration',
      policy_family:  'genai_content_detection',
      scope:   { activities: ['prompt_submit', 'upload'] },
      content: { operator: 'any', conditions: [{ type: 'data_type', risk_family: 'source_code' }] },
      decision: { mode: 'block', require_acknowledgement: false, require_justification: false },
      actions_by_category: {
        approved_supported: 'alert', approved_with_conditions: 'block',
        restricted_unassessed: 'block', prohibited: 'block',
      },
      coaching_by_category: {
        approved_supported: null, approved_with_conditions: 'Source Code or Intellectual Property Detected',
        restricted_unassessed: 'Source Code or Intellectual Property Detected', prohibited: 'GenAI Application Blocked',
      },
    },
  },
  {
    policy_key:  'rf:intellectual_property',
    name:        'GenAI - Intellectual Property Control',
    description: 'Alerts on IP and trade secrets for fully approved apps; blocks for all others.',
    risk_family: 'Intellectual Property',
    rfKey:       'intellectual_property',
    npj: {
      schema_version: '1.0',
      intent:         'prevent_exfiltration',
      policy_family:  'genai_content_detection',
      scope:   { activities: ['prompt_submit', 'upload'] },
      content: { operator: 'any', conditions: [{ type: 'data_type', risk_family: 'intellectual_property' }] },
      decision: { mode: 'block', require_acknowledgement: false, require_justification: false },
      actions_by_category: {
        approved_supported: 'alert', approved_with_conditions: 'block',
        restricted_unassessed: 'block', prohibited: 'block',
      },
      coaching_by_category: {
        approved_supported: null, approved_with_conditions: 'Source Code or Intellectual Property Detected',
        restricted_unassessed: 'Source Code or Intellectual Property Detected', prohibited: 'GenAI Application Blocked',
      },
    },
  },
  {
    policy_key:  'rf:customer_employee_data',
    name:        'GenAI - Customer & Employee Data Control',
    description: 'Alerts for approved apps, requires justification for conditional apps, blocks for restricted and prohibited.',
    risk_family: 'Customer & Employee Data',
    rfKey:       'customer_employee_data',
    npj: {
      schema_version: '1.0',
      intent:         'prevent_exfiltration',
      policy_family:  'genai_content_detection',
      scope:   { activities: ['prompt_submit', 'upload'] },
      content: { operator: 'any', conditions: [{ type: 'data_type', risk_family: 'customer_employee_data' }] },
      decision: { mode: 'block', require_acknowledgement: false, require_justification: false },
      actions_by_category: {
        approved_supported: 'alert', approved_with_conditions: 'coach-just',
        restricted_unassessed: 'block', prohibited: 'block',
      },
      coaching_by_category: {
        approved_supported: null, approved_with_conditions: 'Regulated Data Detected',
        restricted_unassessed: 'Regulated Data Detected', prohibited: 'GenAI Application Blocked',
      },
    },
  },
  {
    policy_key:  'rf:financial_commercial_data',
    name:        'GenAI - Financial & Commercial Data Control',
    description: 'Alerts for approved apps, requires justification for conditional apps, blocks for restricted and prohibited.',
    risk_family: 'Financial & Commercial Data',
    rfKey:       'financial_commercial_data',
    npj: {
      schema_version: '1.0',
      intent:         'prevent_exfiltration',
      policy_family:  'genai_content_detection',
      scope:   { activities: ['prompt_submit', 'upload'] },
      content: { operator: 'any', conditions: [{ type: 'data_type', risk_family: 'financial_commercial_data' }] },
      decision: { mode: 'block', require_acknowledgement: false, require_justification: false },
      actions_by_category: {
        approved_supported: 'alert', approved_with_conditions: 'coach-just',
        restricted_unassessed: 'block', prohibited: 'block',
      },
      coaching_by_category: {
        approved_supported: null, approved_with_conditions: 'Regulated Data Detected',
        restricted_unassessed: 'Regulated Data Detected', prohibited: 'GenAI Application Blocked',
      },
    },
  },
  {
    policy_key:  'rf:legal_contractual_data',
    name:        'GenAI - Legal & Contractual Data Control',
    description: 'Alerts for approved apps, requires justification for conditional apps, blocks for restricted and prohibited.',
    risk_family: 'Legal & Contractual Data',
    rfKey:       'legal_contractual_data',
    npj: {
      schema_version: '1.0',
      intent:         'prevent_exfiltration',
      policy_family:  'genai_content_detection',
      scope:   { activities: ['prompt_submit', 'upload'] },
      content: { operator: 'any', conditions: [{ type: 'data_type', risk_family: 'legal_contractual_data' }] },
      decision: { mode: 'block', require_acknowledgement: false, require_justification: false },
      actions_by_category: {
        approved_supported: 'alert', approved_with_conditions: 'coach-just',
        restricted_unassessed: 'block', prohibited: 'block',
      },
      coaching_by_category: {
        approved_supported: null, approved_with_conditions: 'Classified Data Detected',
        restricted_unassessed: 'Classified Data Detected', prohibited: 'GenAI Application Blocked',
      },
    },
  },
  {
    policy_key:  'rf:security_infrastructure_data',
    name:        'GenAI - Security & Infrastructure Data Control',
    description: 'Requires justification for approved apps; blocks for conditional, restricted, and prohibited.',
    risk_family: 'Security & Infrastructure Data',
    rfKey:       'security_infrastructure_data',
    npj: {
      schema_version: '1.0',
      intent:         'prevent_exfiltration',
      policy_family:  'genai_content_detection',
      scope:   { activities: ['prompt_submit', 'upload'] },
      content: { operator: 'any', conditions: [{ type: 'data_type', risk_family: 'security_infrastructure_data' }] },
      decision: { mode: 'block', require_acknowledgement: false, require_justification: false },
      actions_by_category: {
        approved_supported: 'coach-just', approved_with_conditions: 'block',
        restricted_unassessed: 'block', prohibited: 'block',
      },
      coaching_by_category: {
        approved_supported: 'Sensitive Data Blocked', approved_with_conditions: 'Sensitive Data Blocked',
        restricted_unassessed: 'Sensitive Data Blocked', prohibited: 'GenAI Application Blocked',
      },
    },
  },
  {
    policy_key:  'rf:public_low_risk_data',
    name:        'GenAI - Public & Low-Risk Data Control',
    description: 'Allows for approved apps; prompts acknowledgement for restricted; blocks for prohibited.',
    risk_family: 'Public & Low-Risk Data',
    rfKey:       'public_low_risk_data',
    npj: {
      schema_version: '1.0',
      intent:         'coach_user',
      policy_family:  'genai_content_detection',
      scope:   { activities: ['prompt_submit', 'upload'] },
      content: { operator: 'any', conditions: [{ type: 'data_type', risk_family: 'public_low_risk_data' }] },
      decision: { mode: 'coach', require_acknowledgement: true, require_justification: false },
      actions_by_category: {
        approved_supported: 'allow', approved_with_conditions: 'allow',
        restricted_unassessed: 'coach-ack', prohibited: 'block',
      },
      coaching_by_category: {
        approved_supported: null, approved_with_conditions: null,
        restricted_unassessed: 'GenAI Usage Reminder', prohibited: 'GenAI Application Blocked',
      },
    },
  },
  {
    policy_key:  'rf:bulk_data',
    name:        'GenAI - Bulk Data / Large Dataset Control',
    description: 'Requires justification for approved apps; blocks for conditional, restricted, and prohibited.',
    risk_family: 'Bulk Data / Large Dataset',
    rfKey:       'bulk_data',
    npj: {
      schema_version: '1.0',
      intent:         'prevent_exfiltration',
      policy_family:  'genai_content_detection',
      scope:   { activities: ['prompt_submit', 'upload'] },
      content: { operator: 'any', conditions: [{ type: 'data_type', risk_family: 'bulk_data' }] },
      decision: { mode: 'block', require_acknowledgement: false, require_justification: false },
      actions_by_category: {
        approved_supported: 'coach-just', approved_with_conditions: 'block',
        restricted_unassessed: 'block', prohibited: 'block',
      },
      coaching_by_category: {
        approved_supported: 'Bulk Data Sharing Detected', approved_with_conditions: 'Bulk Data Sharing Detected',
        restricted_unassessed: 'Bulk Data Sharing Detected', prohibited: 'GenAI Application Blocked',
      },
    },
  },
  {
    policy_key:  'rf:large_file_upload',
    name:        'GenAI - Large File Upload Block',
    description: 'Blocks files exceeding size thresholds from being uploaded to any GenAI app.',
    risk_family: 'Large File Upload',
    rfKey:       'large_file_upload',
    npj: {
      schema_version: '1.0',
      intent:         'prevent_exfiltration',
      policy_family:  'genai_content_detection',
      scope:   { activities: ['upload'] },
      content: { operator: 'any', conditions: [{ type: 'data_type', risk_family: 'large_file_upload' }] },
      decision: { mode: 'block', require_acknowledgement: false, require_justification: false },
      actions_by_category: {
        approved_supported: 'block', approved_with_conditions: 'block',
        restricted_unassessed: 'block', prohibited: 'block',
      },
      coaching_by_category: {
        approved_supported: 'Large File Upload Blocked', approved_with_conditions: 'Large File Upload Blocked',
        restricted_unassessed: 'Large File Upload Blocked', prohibited: 'GenAI Application Blocked',
      },
    },
  },
  {
    policy_key:  'rf:general_usage_reminder',
    name:        'GenAI - General Usage Reminder',
    description: 'Monitors for approved apps, coaches with acknowledgement for conditional and restricted, blocks for prohibited.',
    risk_family: 'General Usage Reminder',
    rfKey:       'general_usage_reminder',
    npj: {
      schema_version: '1.0',
      intent:         'coach_user',
      policy_family:  'genai_content_detection',
      scope:   { activities: ['browse', 'login'] },
      content: { operator: 'any', conditions: [] },
      decision: { mode: 'coach', require_acknowledgement: true, require_justification: false },
      actions_by_category: {
        approved_supported: 'monitor', approved_with_conditions: 'coach-ack',
        restricted_unassessed: 'coach-ack', prohibited: 'block',
      },
      coaching_by_category: {
        approved_supported: null, approved_with_conditions: 'GenAI Usage Reminder',
        restricted_unassessed: 'GenAI Usage Reminder', prohibited: 'GenAI Application Blocked',
      },
    },
  },
]
