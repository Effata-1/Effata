/**
 * Presentation types — shared between the Executive Report route and the public /share/[token] page.
 * Kept in lib/genai so neither route depends on the other's directory.
 *
 * PresentationSnapshot: the serialised shape stored in genai_presentations.snapshot
 * Slide* types: view-layer shapes used by PresentationSlideshow and PresentationContainer
 */

// ── Slide-layer types (used by PresentationSlideshow + PresentationContainer) ─

export interface CategorySlide {
  id:             string
  system_tag:     string
  name:           string
  color:          string
  access_posture: string
}

export interface OverrideSlide {
  data_type:                string
  category_id:              string
  action_code:              string
  coaching_notification_id: string | null
}

export interface CoachingSlide {
  id:           string
  coach_label:  string
  control_type: string
}

export interface PolicySlide {
  id:                       string
  name:                     string
  description:              string | null
  policy_type:              string
  primary_action:           string | null
  data_classification_label: string | null
  approval_status:          string
  is_active:                boolean
  scope_all_apps:           boolean
  scope_app_ids:            string[]
  rules:                    unknown[]
  policy_owner:             string | null
  next_review_date:         string | null
  neutral_policy_json:      unknown
  policy_source:            string
  policy_family:            string | null
  test_status:              string | null
  priority:                 number | null
}

export interface AppCounts {
  enterpriseApproved:       number
  approvedWithConditions:   number
  permittedWithRestriction: number
  prohibited:               number
}

export interface SlideData {
  orgName:           string
  industry:          string
  categories:        CategorySlide[]
  matrixOverrides:   OverrideSlide[]
  coachingTemplates: CoachingSlide[]
  policies:          PolicySlide[]
  lintCount:         number
  appCounts:         AppCounts
}

// ── Snapshot type (stored in DB + rendered by share page) ─────────────────────

export interface PresentationSnapshot {
  org_name:       string
  industry:       string
  coverage_score: number | null
  app_counts: {
    enterprise_approved:        number
    approved_with_conditions:   number
    permitted_with_restriction: number
    prohibited:                 number
    total:                      number
  }
  // Slide 3 — DLP matrix
  categories: Array<{
    id:             string
    system_tag:     string
    name:           string
    color:          string
    access_posture: string
  }>
  matrix_overrides: Array<{
    data_type:                string
    category_id:              string
    action_code:              string
    coaching_notification_id: string | null
  }>
  coaching_templates: Array<{
    id:           string
    coach_label:  string
    control_type: string
  }>
  // Slides 4, 5, 7
  policies: Array<{
    id:                       string
    name:                     string
    description:              string | null
    policy_type:              string
    primary_action:           string | null
    data_classification_label: string | null
    approval_status:          string
    is_active:                boolean
    policy_family:            string | null
    test_status:              string | null
  }>
  // Slide 6
  lint_count: number
  generated_at: string
}
