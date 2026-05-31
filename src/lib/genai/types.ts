export type FieldValue =
  | 'yes' | 'no' | 'partial'
  | 'enterprise-only' | 'tier-dependent' | 'configurable'
  | 'no-published' | 'na'

export type DLPValue =
  | 'enforcement' | 'monitoring' | 'partial' | 'no-published' | 'not-supported'

export interface AppFields {
  // Data Governance & Privacy
  dpa_available: FieldValue
  customer_owns_data: FieldValue
  trains_on_customer_data: FieldValue
  opt_out_of_training: FieldValue
  data_retention: FieldValue
  data_deletion: FieldValue
  data_residency: FieldValue
  subprocessor_list: FieldValue
  pii_sharing_third_parties: FieldValue
  data_sharing_genai_vendor: FieldValue
  // Security & Compliance
  soc2: FieldValue
  iso27001: FieldValue
  iso27018: FieldValue
  fedramp: FieldValue
  pci_dss: FieldValue
  hipaa_baa: FieldValue
  encryption_at_rest: FieldValue
  encryption_in_transit: FieldValue
  tenant_segregation: FieldValue
  // GenAI-Specific
  model_provider_clear: FieldValue
  prompt_retention_controls: FieldValue
  connectors_agents_risk: FieldValue   // negative field
}

export interface DLPActivities {
  post_prompt: DLPValue
  upload: DLPValue
  login_instance: DLPValue
  edit: DLPValue
  response: DLPValue
  download: DLPValue
  attach: DLPValue
}

export interface BreachInfo {
  recent_breach: FieldValue          // negative
  older_breach: FieldValue           // negative
  breach_disclosed: FieldValue
  source_disclosure: FieldValue
  breach_remediated: FieldValue
  breach_name?: string
  breach_date?: string
  breach_description?: string
}

export const APP_GROUPS = [
  'AI Chatbots',
  'AI Productivity Copilots',
  'AI Coding Assistants',
  'AI Document Tools',
  'AI Data Analysis',
  'AI Search & Knowledge',
  'AI Customer Support',
  'AI Sales & CRM',
  'AI Workflow & Automation',
  'AI Creative & Design',
  'AI Meeting & Transcription',
  'AI Browser Extensions',
  'AI Agents',
  'AI Model Platforms & APIs',
  'AI Code Execution & Notebooks',
] as const

export type AppGroup = typeof APP_GROUPS[number]

export type ApprovalStatus = 'draft' | 'under-review' | 'approved' | 'rejected' | 'expired'
export type ContractStatus = 'enterprise' | 'free-tier' | 'user-managed' | 'unknown'
export type DpaStatus      = 'approved' | 'pending' | 'not-required' | 'failed' | 'unknown'
export type SecurityReviewStatus = 'approved' | 'pending' | 'failed' | 'unknown'
export type DlpCoverage    = 'supported' | 'partial' | 'not-supported' | 'requires-validation'

export interface GenAIApp {
  app_id: string
  app_name: string
  vendor: string
  domain: string
  app_type: string
  logo_letter: string
  logo_bg: string
  logo_url: string | null
  status: string
  last_updated: string | null
  app_group: AppGroup | null
  description: string | null
  headquarters: string | null
  founded_year: number | null
  employee_count: string | null
  primary_use_cases: string[] | null
}

export interface GenAIAppProfile {
  app_id: string
  fields: AppFields
  dlp: DLPActivities
  breach_info: BreachInfo
}

export interface CustomerClassification {
  org_id:                  string
  app_id:                  string
  customer_classification: CustomerClass
  classification_scope:    string | null
  notes:                   string | null
  // governance metadata (migration 041)
  business_owner:          string | null
  technical_owner:         string | null
  approval_status:         ApprovalStatus | null
  review_date:             string | null
  next_review_date:        string | null
  contract_status:         ContractStatus | null
  dpa_status:              DpaStatus | null
  security_review_status:  SecurityReviewStatus | null
  tenant_instance_id:      string | null
  dlp_coverage:            DlpCoverage | null
}

export type PolicyType = 'usage' | 'data-handling' | 'approved-use' | 'prohibited'

export type ActionCode = 'allow' | 'monitor' | 'alert' | 'coach' | 'coach-ack' | 'coach-just' | 'block' | 'not-set'

export interface PolicyRule {
  data_type:   string
  post_prompt: ActionCode
  upload:      ActionCode
  download:    ActionCode
  response:    ActionCode
}

export interface GenAIPolicy {
  id:               string
  org_id:           string
  name:             string
  description:      string | null
  policy_type:      PolicyType
  category_id:      string | null
  approval_status:  ApprovalStatus
  policy_owner:     string | null
  technical_owner:  string | null
  effective_date:   string | null
  review_date:      string | null
  next_review_date: string | null
  notes:            string | null
  is_active:        boolean
  priority:         number
  // P1-4 scope + rules (migration 043)
  scope_all_apps:   boolean
  scope_app_ids:    string[]
  rules:            PolicyRule[]
  // P2-9 identity context (migration 047)
  identity_context: string[] | null
  // P3 policy metadata (migration 052)
  policy_family:             string | null
  generated_from:            string | null
  data_classification_label: string | null
  primary_action:            ActionCode | null
  fallback_action:           ActionCode | null
  coaching_template_id:      string | null
  vendor_translation_status: 'pending' | 'translated' | 'verified' | 'not-applicable'
  required_dependencies:     string[]
  test_status:               'untested' | 'in-progress' | 'passed' | 'failed'
  created_at:       string
  updated_at:       string
  // migration 079 — predefined policy provenance
  policy_source: 'predefined' | 'matrix' | 'custom'
  is_customized: boolean
  policy_key:    string | null
}

export type CustomerClass =
  | 'enterprise-approved'
  | 'approved-with-conditions'
  | 'permitted-with-restriction'
  | 'personal'
  | 'unknown'
  | 'prohibited'

export type CoachingTone = 'informational' | 'warning' | 'urgent'

export type ControlType =
  | 'block'
  | 'coach_acknowledge'
  | 'coach_justification'
  | 'monitor'
  | 'allow'

export interface CoachingNotification {
  id:                  string
  org_id:              string
  name:                string
  description:         string | null
  coach_label:         string | null
  template_key:        string | null
  action_code:         'coach' | 'coach-ack' | 'coach-just'   // kept for control matrix compat
  control_type:        ControlType
  title:               string
  subtitle:            string | null
  message:             string
  show_exception_line: boolean
  show_details:        boolean
  recommended_for:     string[]
  tokens_used:         string[]
  tone:                CoachingTone
  linked_policy_id:    string | null
  is_default:          boolean
  is_active:           boolean
  created_at:          string
  updated_at:          string
}

export interface TrustScores {
  data_governance:              number
  data_governance_verified:     number
  data_governance_total:        number
  dlp_activity:                 number
  security_compliance:          number
  security_compliance_verified: number
  security_compliance_total:    number
  genai_risk:                   number
  genai_risk_verified:          number
  genai_risk_total:             number
  breach_transparency:          number
  breach_transparency_verified: number
  breach_transparency_total:    number
  raw_score:                    number
  applied_cap:                  string | null
  final_score:                  number
  suggested_classification:     CustomerClass
  dlp_activities_supported:     number
  dlp_activities_total:         number
}
