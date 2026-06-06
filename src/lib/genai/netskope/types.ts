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
  /** Phase 4: activities from the source NPJ's scope.activities. Undefined for pre-Phase 4 NPJs. */
  source_activities?:   string[]
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
  destination:  {
    strategy:       string
    tag_or_category: string
    /** CCI App Tag constraint — only present when strategy = 'app_category'.
     *  In Netskope's UI this is an ADD CRITERIA & CONSTRAINTS entry, not the primary destination type. */
    cci_app_tag?:   string | null
    note:           string | null
  }
  source: {
    type:        NpjSourceType
    value:       string | null
    /** Phase 4.5: source identity exclusions (User / User Group / OU narrowing only). */
    exclusions?: NpjScopeExclusion[]
  }
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
  /** Replaces url_lists — Netskope renamed URL Lists to Destination Profiles. */
  destination_profiles:          string[]
  /** Single apps from the App Catalog (Netskope "Cloud App" destination type). */
  cloud_apps:                    string[]
  user_groups:                   string[]
  ad_groups:                     string[]
  /** Phase 4.5: individual Netskope user objects required by source/exclusion selectors. */
  users:                         string[]
  /** Phase 4.5: AD Organizational Unit paths required by source/exclusion selectors. */
  organizational_units:          string[]
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

// ── Phase 3: Scoped NPJ types ─────────────────────────────────────────────────

// Phase 4.5: all Netskope source selector types.
// ad_group = AD security group (CN=...). organizational_unit = AD OU (OU=...).
// These are separate objects in both AD and Netskope.
export type NpjSourceType =
  | 'all_users'
  | 'user'
  | 'user_group'
  | 'ad_group'
  | 'organizational_unit'

// Phase 4.5: types allowed in Netskope's Source Exclusion panel.
// Based on the Netskope UI: User / User Group / Organizational Unit.
// ad_group intentionally excluded until Netskope exclusion support for AD security groups is verified.
export type NpjScopeExclusionType = 'user' | 'user_group' | 'organizational_unit'

// Source exclusion entry — narrows WHO the source selector applies to.
// Meaning: Source = User Group: Engineering, Exclude = User: contractor@company.com
// This is NOT a policy-level exclusion. Only source/identity membership is narrowed.
export interface NpjScopeExclusion {
  type:  NpjScopeExclusionType
  value: string
}

export interface NpjScopeSource {
  type:  NpjSourceType
  value: string | null
}

// Canonical destination types emitted by the engine and stored in NPJs.
// Legacy values 'app_tag' and 'url_list' are accepted as input aliases in resolveNpjScope()
// and normalised before any downstream code sees them — never emitted.
export interface NpjScopeDestination {
  type:        'app_category' | 'app_instance' | 'destination_profile' | 'cloud_app'
  value:       string
  /** CCI App Tag constraint — only valid when type = 'app_category'. */
  cci_app_tag?: string
  app?:        string
  instance?:   string
}

export interface ScopedNpjInput {
  policy_id:              string
  policy_name:            string
  policy_family:          string
  risk_family_key:        string
  risk_family_label:      string
  actions_by_category:    Record<string, string>
  coaching_by_category?:  Record<string, string | null>
  source:                 NpjScopeSource
  destination:            NpjScopeDestination
  destination_defaulted?: boolean
  /** Phase 4: activities from the source NPJ's scope.activities. Undefined for pre-Phase 4 NPJs. */
  source_activities?:     string[]
  /** Phase 4.5: source identity exclusions parsed from scope.exclusions. */
  source_exclusions?:     NpjScopeExclusion[]
}

export interface ScopedPoliciesResult {
  policies:         NetskopePolicy[]
  required_objects: RequiredObjects
  issues:           RecommendationIssue[]
  overflow_count:   number
}

export type SourceStrategyType      = NpjSourceType
export type DestinationStrategyType = 'app_category' | 'app_instance' | 'destination_profile' | 'cloud_app'

export interface CategoryStrategyOverride {
  source_type:       SourceStrategyType
  source_value:      string | null
  destination_type:  DestinationStrategyType
  destination_value: string | null
}

export type StrategyOverrides = Partial<Record<NetskopeCategory, CategoryStrategyOverride>>

// ── Phase 2: Topology option types ───────────────────────────────────────────

export type TopologyMode =
  | 'hybrid_category_based'
  | 'consolidated'
  | 'per_risk_family'

export interface TopologyTradeOff {
  pro: string
  con: string
}

export interface TopologyOptionSummary {
  mode:             TopologyMode
  label:            string
  score:            number
  confidence:       'high' | 'medium' | 'low'
  policy_count:     number
  trade_offs:       TopologyTradeOff[]
  recommended:      boolean
  policies:         NetskopePolicy[]
  required_objects: RequiredObjects
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
  topology_options:     TopologyOptionSummary[]    // Phase 2
  scoped_policies:      ScopedPoliciesResult | null // Phase 3: null when no scoped NPJs detected
  strategy_overrides:   null                        // Phase 3: always null from server; overrides live in client state
  manual_policies:      NetskopePolicy[]            // Manual/AI-generated policies shown in their own section
}
