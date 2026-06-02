// Netskope Intelligent Policy Recommendation Engine — Phase 1 types.
// The engine transposes NPJ (risk_family × category → actions)
// into Netskope topology (category → risk_families → actions).

export type NpjProfileType =
  | 'content_detection'
  | 'classification_label'
  | 'filename_detection'
  | 'filetype_detection'

export type NetskopeCategory =
  | 'approved_supported'
  | 'approved_with_conditions'
  | 'restricted_unassessed'

// ── Transposition types ───────────────────────────────────────────────────────

export interface TransposedProfile {
  risk_family_key:      string
  risk_family_label:    string
  profile_type:         NpjProfileType
  action:               string
  coaching_template_id: string | null
}

// The 3 standard keys are always present; additional keys are custom categories.
export type CategoryBuckets = Record<string, TransposedProfile[]>

// ── Netskope policy types ─────────────────────────────────────────────────────

export interface NetskopeProfileEntry {
  profile:           string
  profile_type:      NpjProfileType
  profile_action:    string
  coaching_template: string | null
}

export interface ContinuePolicyEvaluation {
  recommended:  boolean
  applies_when: string
  limitation:   string
}

export interface NetskopePolicy {
  priority:     number
  policy_key:   string
  name:         string
  policy_type:  'access_control' | 'realtime_protection'
  destination:  { strategy: string; tag_or_category: string; note: string | null }
  source:       { type: 'all_users' | 'ad_group'; value: string | null }
  activities:   string[]
  profiles:     NetskopeProfileEntry[]
  no_match_action:            string | null
  continue_policy_evaluation: ContinuePolicyEvaluation | null
  notification: string | null
}

// ── Supporting types ──────────────────────────────────────────────────────────

// Phase 1: plain string arrays.
// Future: extend to { name: string; type: string; status: 'mapped' | 'missing' | 'assumed' }
export interface RequiredObjects {
  dlp_profiles:                  string[]
  classification_label_profiles: string[]
  filename_profiles:             string[]
  filetype_profiles:             string[]
  notification_templates:        string[]
  cci_app_tags:                  string[]
  app_categories:                string[]
  app_instances:                 string[]
  app_instance_tags:             string[]
  url_lists:                     string[]
  policy_order:                  string[]
}

export interface LimitationEntry {
  area:             string
  limitation:       string
  practical_impact: string
  risk_acceptance:  'Accepted' | 'Known'
}

export interface ValidationItem {
  id:       number
  text:     string
  critical: boolean
}

export interface SkippedPolicy {
  policy_id:   string
  policy_name: string
  reason:      string
  fix:         string
}

export interface RecommendationIssue {
  code:        string
  severity:    'error' | 'warning' | 'info'
  description: string
  fix:         string | null
}

// ── Top-level recommendation ──────────────────────────────────────────────────

export interface NetskopeRecommendation {
  vendor:               'netskope'
  recommendation_mode:  'default'
  selected_topology:    'hybrid_category_based'
  is_partial:           boolean
  confidence:           'high' | 'medium' | 'low'
  score:                number
  why_selected:         string[]
  recommended_policies: NetskopePolicy[]
  required_objects:     RequiredObjects
  limitations:          LimitationEntry[]
  validation_checklist: ValidationItem[]
  skipped_policies:     SkippedPolicy[]
  issues:               RecommendationIssue[]
  inline_file_size_limit_mb: number
}
