'use client'

import { PresentationSlideshow }   from '@/components/presentation/presentation-slideshow'
import type { PresentationSnapshot } from '@/lib/genai/presentation-types'

interface Props {
  snapshot:  PresentationSnapshot
  createdAt: string
}

// Adapts the snapshot shape to the SlideData shape expected by PresentationSlideshow.
// The share page is always in "presenting" mode — no document view, no close button.
export function SharedDeck({ snapshot, createdAt }: Props) {
  return (
    <div className="fixed inset-0" style={{ backgroundColor: '#0F1117' }}>
      <PresentationSlideshow
        orgName={snapshot.org_name}
        industry={snapshot.industry}
        categories={snapshot.categories}
        matrixOverrides={snapshot.matrix_overrides}
        coachingTemplates={snapshot.coaching_templates ?? []}
        policies={snapshot.policies.map(p => ({
          ...p,
          scope_all_apps:      false,
          scope_app_ids:       [],
          rules:               [],
          policy_owner:        null,
          next_review_date:    null,
          neutral_policy_json: null,
          policy_source:       'manual',
          priority:            null,
        }))}
        lintCount={snapshot.lint_count ?? 0}
        appCounts={{
          enterpriseApproved:       snapshot.app_counts.enterprise_approved,
          approvedWithConditions:   snapshot.app_counts.approved_with_conditions,
          permittedWithRestriction: snapshot.app_counts.permitted_with_restriction,
          prohibited:               snapshot.app_counts.prohibited,
        }}
        // Share page — no close/escape (there's nowhere to go)
        onClose={() => { /* noop — no parent document view on the share page */ }}
        sharedAt={createdAt}
        isSharedView
      />
    </div>
  )
}
