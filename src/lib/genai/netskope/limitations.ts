import type { LimitationEntry, ValidationItem } from './types'

export const INLINE_FILE_SIZE_LIMIT_MB = 128
export const FILE_SIZE_LIMIT_SOURCE = 'default_assumption' as const

export const LIMITATIONS: LimitationEntry[] = [
  {
    area:             'App activity coverage',
    limitation:       'Not every GenAI app exposes the same real-time activities for DLP inspection.',
    practical_impact: 'Some apps may support only partial visibility, so prompt, post, and upload controls may not be consistently enforceable.',
    risk_acceptance:  'Accepted',
  },
  {
    area:             'App instance / tenant separation',
    limitation:       'Enterprise and personal use of the same app may not always be clearly distinguishable.',
    practical_impact: 'Personal instances of the same app could be allowed or controlled less accurately.',
    risk_acceptance:  'Accepted',
  },
  {
    area:             'AD group dependency',
    limitation:       'Some apps may not yet have dedicated AD groups defined for user-based scoping.',
    practical_impact: 'Until AD groups are established, those apps may need to be handled under Approved with Conditions or Restricted / Unassessed with more restrictive controls.',
    risk_acceptance:  'Accepted',
  },
  {
    area:             'User-based allowance risk',
    limitation:       'Allowing access based only on user identity can create leakage gaps.',
    practical_impact: 'Users may bypass the intended corporate-instance-only model by using personal accounts if destination/instance controls are not reliable.',
    risk_acceptance:  'Accepted',
  },
  {
    area:             'Large files / timeout limits',
    limitation:       `Inline inspection is constrained by file size and scanning limits (default assumption: ${INLINE_FILE_SIZE_LIMIT_MB} MB — confirm in tenant).`,
    practical_impact: 'Large files may cause latency, missed detections, timeout behavior, or inconsistent enforcement.',
    risk_acceptance:  'Accepted',
  },
  {
    area:             'Production Allow / DND conflicts',
    limitation:       'Existing Allow or Do-Not-Decrypt policies can interfere with DLP inspection.',
    practical_impact: 'Test results in UAT may not fully match production behavior.',
    risk_acceptance:  'Known',
  },
  {
    area:             'Policy ordering dependency',
    limitation:       'Netskope policy outcome depends heavily on policy order.',
    practical_impact: 'A broader Allow, Alert, or DND policy placed above the GenAI policy may reduce enforcement.',
    risk_acceptance:  'Known',
  },
  {
    area:             'Notification / template dependency',
    limitation:       'Block, coach, and justification behavior depends on correct user notification template mapping.',
    practical_impact: 'Incorrect templates may create confusing user experience or wrong enforcement UX.',
    risk_acceptance:  'Accepted',
  },
  {
    area:             'Consolidated policy reporting',
    limitation:       'Multiple DLP profiles inside one policy reduce policy count but can reduce separation by risk family.',
    practical_impact: 'Reporting may be less clean compared with one policy per risk family.',
    risk_acceptance:  'Accepted',
  },
]

export const VALIDATION_CHECKLIST: ValidationItem[] = [
  { id: 1,  text: 'Validate that selected apps support Post and Upload activity inspection.',                    critical: true  },
  { id: 2,  text: 'Validate that SSL inspection is enabled for selected GenAI destinations.',                   critical: true  },
  { id: 3,  text: 'Validate no SSL Do Not Decrypt or Allow policy bypasses these controls.',                   critical: true  },
  { id: 4,  text: 'Validate CCI App Tags correctly map to governance categories.',                             critical: true  },
  { id: 5,  text: 'Validate App Instance detection for enterprise vs personal separation.',                     critical: false },
  { id: 6,  text: 'Validate AD group membership for BU/team entitlement.',                                     critical: false },
  { id: 7,  text: 'Validate notification templates exist and are correctly mapped.',                           critical: true  },
  { id: 8,  text: 'Validate DLP profiles exist and are tuned.',                                                critical: true  },
  { id: 9,  text: 'Validate policy ordering before enforcement — prohibited and always-block policies are first.', critical: true },
  { id: 10, text: 'Validate Alert + Continue behavior for alert-only policies.',                               critical: false },
  { id: 11, text: 'Validate incident/reporting expectations for consolidated policies.',                       critical: false },
  { id: 12, text: 'Validate fallback behavior for Restricted / Unassessed (no-match = Alert).',                critical: false },
]
