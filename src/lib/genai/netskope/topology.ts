// Netskope 5-Policy Topology Builder
// Assembles the hybrid category-based Netskope policy stack from transposed profiles.

import type {
  CategoryBuckets, NetskopeCategory, NetskopePolicy, NetskopeProfileEntry,
  NetskopeRecommendation, RecommendationIssue, RequiredObjects,
  TransposedProfile,
} from './types'
import type { NpjInput } from './transpose'
import { VALIDATION_CHECKLIST } from './limitations'

// ── Policy priority ordering ──────────────────────────────────────────────────
// Lower number = higher priority in Netskope (processed first).

const PRIORITIES = {
  prohibited_access_block:  100,
  always_block_global_dlp:  200,
  approved_supported:       300,
  approved_with_conditions: 400,
  restricted_unassessed:    900, // always last — catch-all (P450–P890 reserved for future custom policies)
} as const

// ── Fixed no-match actions (Phase 1 — no posture selector) ───────────────────

const NO_MATCH_ACTION: Record<NetskopeCategory, string> = {
  approved_supported:       'allow',
  approved_with_conditions: 'allow',
  restricted_unassessed:    'alert',
}

// ── Category display names → Netskope policy names ───────────────────────────

const CATEGORY_POLICY_NAMES: Record<NetskopeCategory, string> = {
  approved_supported:       'GenAI — Approved & Supported — Content Protection',
  approved_with_conditions: 'GenAI — Approved with Conditions — Content Protection',
  restricted_unassessed:    'GenAI — Restricted / Unassessed — Fallback',
}

const CATEGORY_APP_TAGS: Record<NetskopeCategory, string> = {
  approved_supported:       'Approved & Supported GenAI',
  approved_with_conditions: 'Approved with Conditions GenAI',
  restricted_unassessed:    'Generative AI', // broad category as catch-all
}

// ── Profile type group labels (for UI ordering) ───────────────────────────────

const PROFILE_TYPE_ORDER = [
  'content_detection',
  'classification_label',
  'filename_detection',
  'filetype_detection',
] as const

function sortProfiles(profiles: NetskopeProfileEntry[]): NetskopeProfileEntry[] {
  return [...profiles].sort((a, b) => {
    const ia = PROFILE_TYPE_ORDER.indexOf(a.profile_type as typeof PROFILE_TYPE_ORDER[number])
    const ib = PROFILE_TYPE_ORDER.indexOf(b.profile_type as typeof PROFILE_TYPE_ORDER[number])
    return ia - ib
  })
}

// ── Continue Policy Evaluation logic ─────────────────────────────────────────
// Recommended only when ALL profiles in the policy have alert action.
// Mixed-action policies terminate on non-alert matches.

export function buildContinuePolicyEvaluation(profiles: NetskopeProfileEntry[]) {
  const isAlertOnly = profiles.length > 0 && profiles.every(p => p.profile_action === 'alert')
  return {
    recommended:  isAlertOnly,
    applies_when: 'Policy contains alert-only DLP profile actions and downstream policies should still evaluate the same traffic.',
    limitation:   'Profile matches with actions other than Alert (Block, Coach, etc.) terminate policy processing regardless of this setting.',
  }
}

// ── Required objects collector ────────────────────────────────────────────────

export function collectRequiredObjects(
  policies: NetskopePolicy[],
): RequiredObjects {
  const dlp       = new Set<string>()
  const labels    = new Set<string>()
  const filenames = new Set<string>()
  const filetypes = new Set<string>()
  const notifs    = new Set<string>()
  const tags      = new Set<string>()
  const cats      = new Set<string>()

  for (const p of policies) {
    if (p.destination.tag_or_category) {
      if (p.destination.strategy === 'app_tag') {
        tags.add(p.destination.tag_or_category)
      } else {
        cats.add(p.destination.tag_or_category)
      }
    }
    if (p.notification) notifs.add(p.notification)

    for (const pr of p.profiles) {
      if (pr.profile_type === 'content_detection')    dlp.add(pr.profile)
      if (pr.profile_type === 'classification_label') labels.add(pr.profile)
      if (pr.profile_type === 'filename_detection')   filenames.add(pr.profile)
      if (pr.profile_type === 'filetype_detection')   filetypes.add(pr.profile)
      if (pr.coaching_template) notifs.add(pr.coaching_template)
    }
  }

  return {
    dlp_profiles:                  [...dlp],
    classification_label_profiles: [...labels],
    filename_profiles:             [...filenames],
    filetype_profiles:             [...filetypes],
    notification_templates:        [...notifs],
    cci_app_tags:                  [...tags],
    app_categories:                [...cats],
    app_instances:                 [],
    app_instance_tags:             [],
    url_lists:                     [],
    user_groups:                   [],
    ad_groups:                     [],
    policy_order:                  policies.map(p => p.name),
  }
}

// ── Scoring ───────────────────────────────────────────────────────────────────

function computeScore(params: {
  hasProhibitedCategory:  boolean
  hasAlwaysBlockProfiles: boolean
  skippedCount:           number
  restrictedEmpty:        boolean
}): { score: number; confidence: 'high' | 'medium' | 'low' } {
  let score = 92
  if (!params.hasProhibitedCategory)  score -= 10
  if (!params.hasAlwaysBlockProfiles) score -= 10
  score -= params.skippedCount * 5
  if (params.restrictedEmpty) score -= 10
  score = Math.max(50, score)
  const confidence = score >= 85 ? 'high' : score >= 70 ? 'medium' : 'low'
  return { score, confidence }
}

// ── Main builder ──────────────────────────────────────────────────────────────

export interface BuildTopologyInput {
  buckets:              CategoryBuckets
  alwaysBlockNpjs:      NpjInput[]
  prohibitedCategory:   { id: string; name: string; system_tag: string } | null
  skippedCount:         number
  categoryNameMap?:     Record<string, string>  // system_tag → display name for custom categories
}

export function buildTopology(input: BuildTopologyInput): Omit<NetskopeRecommendation, 'skipped_policies' | 'limitations' | 'inline_file_size_limit_mb' | 'topology_options' | 'scoped_policies' | 'strategy_overrides'> {
  const { buckets, alwaysBlockNpjs, prohibitedCategory, skippedCount, categoryNameMap = {} } = input
  const policies: NetskopePolicy[] = []
  const issues: RecommendationIssue[] = []
  const whySelected: string[] = []

  // ── Policy 0: Prohibited Access Block ──────────────────────────────────────
  if (prohibitedCategory) {
    policies.push({
      priority:    PRIORITIES.prohibited_access_block,
      policy_key:  'netskope:prohibited_access_block',
      name:        'GenAI — Prohibited Applications — Access Block',
      policy_type: 'access_control',
      destination: {
        strategy:         'app_tag',
        tag_or_category:  prohibitedCategory.name,
        note:             'App tag or URL list for Prohibited GenAI apps',
      },
      source:          { type: 'all_users', value: null },
      activities:      ['browse', 'login'],
      profiles:        [],
      no_match_action: null,
      continue_policy_evaluation: null,
      notification:    'GenAI Application Blocked',
    })
    whySelected.push('Prohibited apps are blocked at the access layer before content inspection runs.')
  } else {
    issues.push({
      code:        'PROHIBITED_TAG_MISSING',
      severity:    'warning',
      description: 'Prohibited GenAI governance category is not configured. Policy 0 (Access Block) was not generated.',
      fix:         'Configure a Prohibited GenAI governance category in App Governance settings.',
    })
  }

  // ── Policy 1: Always-Block Global DLP ──────────────────────────────────────
  if (alwaysBlockNpjs.length > 0) {
    const alwaysBlockProfiles: NetskopeProfileEntry[] = alwaysBlockNpjs.map(npj => ({
      profile:           npj.risk_family_label,
      profile_type:      'content_detection' as const,
      profile_action:    'block',
      coaching_template: npj.coaching_by_category?.['approved_supported'] ?? null,
    }))

    policies.push({
      priority:    PRIORITIES.always_block_global_dlp,
      policy_key:  'netskope:always_block_global_dlp',
      name:        'GenAI — Secrets & Keys — Global Block',
      policy_type: 'realtime_protection',
      destination: {
        strategy:        'app_category',
        tag_or_category: 'Generative AI',
        note:            'Applies to all GenAI apps regardless of governance category',
      },
      source:          { type: 'all_users', value: null },
      activities:      ['post', 'upload', 'prompt_submit'],
      profiles:        alwaysBlockProfiles,
      no_match_action: null,
      // Policy 200: block only when Credentials profile matches.
      // No DLP match = no decision / standard pass-through to P300/P400/P900.
      // This is NOT Alert + Continue — do not set continue_policy_evaluation here.
      continue_policy_evaluation: null,
      notification:    'Credential Sharing Blocked',
    })
    whySelected.push('Credentials and secrets are isolated into a top-priority global block policy for maximum enforcement separation.')
  } else {
    issues.push({
      code:        'NO_ALWAYS_BLOCK_PROFILE',
      severity:    'warning',
      description: 'No risk families qualify for the global always-block policy. Credentials & Secrets may not be in scope or may not be block on all active categories.',
      fix:         'Review the Control Matrix — Credentials, Keys & Secrets row should be set to Block on all categories.',
    })
  }

  // ── Policies 2–4: Category policies ────────────────────────────────────────
  const categoryOrder: NetskopeCategory[] = [
    'approved_supported',
    'approved_with_conditions',
    'restricted_unassessed',
  ]

  for (const cat of categoryOrder) {
    const profilesForCat = buckets[cat]
    const profiles: NetskopeProfileEntry[] = sortProfiles(
      profilesForCat.map(p => ({
        profile:           p.risk_family_label,
        profile_type:      p.profile_type,
        profile_action:    p.action,
        coaching_template: p.coaching_template_id,
      }))
    )

    const isRestrictedCatchAll = cat === 'restricted_unassessed'

    policies.push({
      priority:    PRIORITIES[cat],
      policy_key:  `netskope:${cat}`,
      name:        CATEGORY_POLICY_NAMES[cat],
      policy_type: 'realtime_protection',
      destination: {
        strategy:        isRestrictedCatchAll ? 'app_category' : 'app_tag',
        tag_or_category: CATEGORY_APP_TAGS[cat],
        note:            isRestrictedCatchAll
          ? 'Broad Generative AI category as catch-all for apps not covered by approved-category policies'
          : null,
      },
      source:          { type: 'all_users', value: null },
      // TODO Phase 3: derive from union of NPJ scope.activities across bucket profiles.
      // Phase 1: standard GenAI activity set applied to all category policies.
      activities:      ['post', 'upload', 'prompt_submit'],
      profiles,
      no_match_action: NO_MATCH_ACTION[cat],
      continue_policy_evaluation: buildContinuePolicyEvaluation(profiles),
      notification:    null,
    })
  }

  if (buckets.restricted_unassessed.length === 0) {
    issues.push({
      code:        'RESTRICTED_BUCKET_EMPTY',
      severity:    'info',
      description: 'Restricted / Unassessed fallback policy has no enforcement profiles. All risk families may be set to Allow for this category.',
      fix:         'Review the Control Matrix restricted_unassessed column. Consider setting sensitive risk families to Block.',
    })
  }

  // ── Custom category policies (sit between AwC and R/U catch-all) ──────────
  const STANDARD_CATS = new Set(['approved_supported', 'approved_with_conditions', 'restricted_unassessed'])
  const customCatKeys = Object.keys(buckets).filter(k => !STANDARD_CATS.has(k))
  let customPriority = 450
  for (const catKey of customCatKeys) {
    const profilesForCat = buckets[catKey] ?? []
    if (profilesForCat.length === 0) continue
    // Guard: never let custom policies reach P900 (reserved for R/U catch-all).
    // P450–P890 is available for custom categories, AD group, app-instance,
    // personal-instance block, and exception policies in future phases.
    if (customPriority >= 900) {
      issues.push({
        code:        'CUSTOM_CATEGORY_OVERFLOW',
        severity:    'warning',
        description: `Custom category "${catKey}" could not be assigned a priority — too many custom categories queued before the Restricted / Unassessed catch-all at P900.`,
        fix:         'Reduce the number of custom governance categories, or manually adjust policy priorities in the Netskope console.',
      })
      continue
    }

    const catDisplayName = categoryNameMap[catKey]
      ?? catKey.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

    const profiles: NetskopeProfileEntry[] = sortProfiles(
      profilesForCat.map(p => ({
        profile:           p.risk_family_label,
        profile_type:      p.profile_type,
        profile_action:    p.action,
        coaching_template: p.coaching_template_id,
      }))
    )

    policies.push({
      priority:    customPriority,
      policy_key:  `netskope:custom:${catKey}`,
      name:        `GenAI — ${catDisplayName} — Content Protection`,
      policy_type: 'realtime_protection',
      destination: {
        strategy:        'app_tag',
        tag_or_category: `${catDisplayName} GenAI`,
        note:            'Custom CCI app tag — verify this tag exists in your Netskope tenant',
      },
      source:          { type: 'all_users', value: null },
      activities:      ['post', 'upload', 'prompt_submit'],
      profiles,
      no_match_action: null,
      continue_policy_evaluation: {
        recommended:  false,
        applies_when: 'No DLP profile match for this custom category.',
        limitation:   'No-match action not configured — decide based on your risk tolerance for this category (Allow / Alert / Block) and set it explicitly in Netskope before deploying.',
      },
      notification:    null,
    })
    customPriority += 10

    whySelected.push(`Custom category "${catDisplayName}" has enforcement controls and is included as a dedicated policy before the Restricted / Unassessed catch-all.`)
  }

  whySelected.push('Category policies use CCI App Tags for approved categories and Generative AI category as a fallback for Restricted / Unassessed.')
  if (buckets.approved_supported.length > 0 || buckets.approved_with_conditions.length > 0) {
    whySelected.push('Approved & Supported and Approved with Conditions default to Allow on no-match, preserving normal enterprise GenAI usage.')
  }
  if (buckets.restricted_unassessed.length > 0) {
    whySelected.push('Restricted / Unassessed defaults to Alert on no-match to monitor unknown apps without blocking productivity.')
  } else {
    whySelected.push('Restricted / Unassessed fallback policy included as catch-all with no enforcement profiles — monitors unclassified GenAI traffic via no-match Alert.')
  }

  const required_objects = collectRequiredObjects(policies)
  const { score, confidence } = computeScore({
    hasProhibitedCategory:  !!prohibitedCategory,
    hasAlwaysBlockProfiles: alwaysBlockNpjs.length > 0,
    skippedCount,
    restrictedEmpty:        buckets.restricted_unassessed.length === 0,
  })

  const is_partial =
    !prohibitedCategory ||
    alwaysBlockNpjs.length === 0 ||
    skippedCount > 0 ||
    issues.some(i => i.severity === 'error')

  return {
    vendor:               'netskope',
    recommendation_mode:  'default',
    selected_topology:    'hybrid_category_based',
    is_partial,
    confidence,
    score,
    why_selected:         whySelected,
    recommended_policies: policies,
    required_objects,
    validation_checklist: VALIDATION_CHECKLIST,
    issues,
  }
}
