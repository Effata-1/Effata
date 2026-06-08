'use client'

import { useState } from 'react'
import { PresentationActionsBar } from './presentation-actions-bar'
import { PresentationSlideshow }  from './presentation-slideshow'

// ── Shared types ──────────────────────────────────────────────────────────────

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

interface Props extends SlideData {
  existing:  { id: string; public_token: string; revoked_at: string | null; created_at: string } | null
  children:  React.ReactNode
}

export function PresentationContainer({ existing, children, ...slideData }: Props) {
  const [isPresenting, setIsPresenting] = useState(false)

  return (
    <>
      <PresentationActionsBar
        existing={existing}
        onPresent={() => setIsPresenting(true)}
      />

      {children}

      {isPresenting && (
        <PresentationSlideshow
          {...slideData}
          onClose={() => setIsPresenting(false)}
        />
      )}
    </>
  )
}
