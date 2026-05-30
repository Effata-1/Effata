/**
 * Netskope translation readiness check.
 * Pure computation — no IO. Runs in the server component after data is fetched.
 *
 * Primary driver: org_genai_policies.neutral_policy_json — tells us what mappings are *required*.
 * Secondary: org_vendor_translations.mapping_report — supplements with already-computed gaps.
 */

export interface OrgVendorObjectMappingRow {
  id:                    string
  neutral_object_type:   string
  neutral_object_key:    string
  vendor_object_type:    string
  vendor_object_name:    string
  vendor_object_id:      string | null
  mapping_quality:       string
  verification_status:   string
  verified:              boolean
  not_applicable:        boolean
  mapping_purpose:       string
  verification_note:     string | null
}

export interface ReadinessMappingSummaryEntry {
  mapped:         number
  total:          number
  not_applicable: number
}

export interface ReadinessCheckResult {
  score:           number   // 0–100
  status:          'ready' | 'partial' | 'not_ready'
  critical_gaps:   string[]
  warnings:        string[]
  recommendations: string[]
  mapping_summary: {
    app_categories:         ReadinessMappingSummaryEntry
    dlp_profiles:           ReadinessMappingSummaryEntry
    labels:                 ReadinessMappingSummaryEntry
    notification_templates: ReadinessMappingSummaryEntry
  }
}

interface NpjLike {
  scope?: {
    app_categories?: Array<{ id: string; system_tag?: string | null }>
  }
  content?: {
    conditions?: Array<{ type: string; sensitivity?: string; label_id?: string }>
  }
  decision?: {
    mode?: string
  }
}

function isMapped(
  mappings: OrgVendorObjectMappingRow[],
  neutral_object_type: string,
  neutral_object_key: string,
): 'mapped' | 'not_applicable' | 'missing' {
  const match = mappings.find(
    m => m.neutral_object_type === neutral_object_type && m.neutral_object_key === neutral_object_key,
  )
  if (!match) return 'missing'
  if (match.not_applicable) return 'not_applicable'
  return 'mapped'
}

function isVerified(
  mappings: OrgVendorObjectMappingRow[],
  neutral_object_type: string,
  neutral_object_key: string,
): boolean {
  const match = mappings.find(
    m => m.neutral_object_type === neutral_object_type && m.neutral_object_key === neutral_object_key,
  )
  return !!match && match.verified && match.verification_status === 'verified' && !match.not_applicable
}

export function checkNetskopeReadiness(params: {
  policies:     Array<{ neutral_policy_json: unknown }>
  mappings:     OrgVendorObjectMappingRow[]
  translations: Array<{ mapping_report: Record<string, unknown> | null; status: string }>
}): ReadinessCheckResult {
  const { policies, mappings, translations } = params

  // Derive required mappings from policy neutral_policy_json
  const requiredAppCategories    = new Set<string>()
  const requiredSensitivities    = new Set<string>()
  const requiredLabels           = new Set<string>()
  let   needsCoachNotification   = false

  for (const p of policies) {
    const npj = p.neutral_policy_json as NpjLike | null
    if (!npj) continue

    for (const cat of npj.scope?.app_categories ?? []) {
      const key = cat.system_tag ?? cat.id
      if (key) requiredAppCategories.add(key)
    }

    for (const cond of npj.content?.conditions ?? []) {
      if (cond.type === 'data_type' && cond.sensitivity) {
        requiredSensitivities.add(cond.sensitivity)
      } else if (cond.type === 'classification_label' && cond.label_id) {
        requiredLabels.add(cond.label_id)
      }
    }

    const mode = npj.decision?.mode ?? ''
    if (mode.startsWith('coach')) needsCoachNotification = true
  }

  // Also pull any gaps from existing translations
  const translationGaps: string[] = []
  for (const t of translations) {
    const required = (t.mapping_report?.customer_mapping_required as string[] | undefined) ?? []
    translationGaps.push(...required)
  }

  // Compute summary
  const computeSummary = (
    requiredKeys: Set<string>,
    type: string,
  ): ReadinessMappingSummaryEntry => {
    let mapped = 0, not_applicable = 0
    for (const key of requiredKeys) {
      const result = isMapped(mappings, type, key)
      if (result === 'mapped') mapped++
      else if (result === 'not_applicable') not_applicable++
    }
    return { mapped, total: requiredKeys.size, not_applicable }
  }

  const appCatSummary = computeSummary(requiredAppCategories, 'app_category')
  const dlpSummary    = computeSummary(requiredSensitivities, 'sensitivity_level')
  const labelSummary  = computeSummary(requiredLabels, 'classification_label')

  let notifSummary: ReadinessMappingSummaryEntry
  if (!needsCoachNotification) {
    notifSummary = { mapped: 0, total: 0, not_applicable: 0 }
  } else {
    const notifResult = isMapped(mappings, 'notification_template', 'default-coach')
    notifSummary = {
      mapped:         notifResult === 'mapped' ? 1 : 0,
      total:          1,
      not_applicable: notifResult === 'not_applicable' ? 1 : 0,
    }
  }

  // Score calculation
  let score = 100
  const critical_gaps:   string[] = []
  const warnings:        string[] = []
  const recommendations: string[] = []

  // App category gaps — critical
  const missingAppCats = [...requiredAppCategories].filter(k => isMapped(mappings, 'app_category', k) === 'missing')
  for (const key of missingAppCats) {
    critical_gaps.push(`App category mapping missing: "${key}" — Netskope destination will use placeholder`)
    score -= 20
  }
  if (missingAppCats.length > 0) score = Math.min(score, 60)

  // DLP profile gaps — critical
  const missingSens = [...requiredSensitivities].filter(k => isMapped(mappings, 'sensitivity_level', k) === 'missing')
  for (const key of missingSens) {
    critical_gaps.push(`DLP profile mapping missing for sensitivity: "${key}"`)
    score -= 20
  }
  if (missingSens.length > 0) score = Math.min(score, 55)

  // Unverified mappings — warnings
  for (const key of requiredAppCategories) {
    if (isMapped(mappings, 'app_category', key) === 'mapped' && !isVerified(mappings, 'app_category', key)) {
      warnings.push(`App category mapping for "${key}" is configured but not verified`)
      score -= 10
    }
  }
  for (const key of requiredSensitivities) {
    if (isMapped(mappings, 'sensitivity_level', key) === 'mapped' && !isVerified(mappings, 'sensitivity_level', key)) {
      warnings.push(`DLP profile mapping for sensitivity "${key}" is configured but not verified`)
      score -= 10
    }
  }

  // Notification template
  if (needsCoachNotification && notifSummary.mapped === 0 && notifSummary.not_applicable === 0) {
    warnings.push('Coaching notification template mapping missing: "default-coach"')
    score -= 5
  }

  // Translation-derived gaps (non-critical)
  const uniqueGaps = [...new Set(translationGaps)]
  for (const gap of uniqueGaps) {
    if (!critical_gaps.includes(gap) && !warnings.includes(gap)) {
      score -= 5
    }
  }

  // Recommendations
  if (missingAppCats.length > 0) {
    recommendations.push('Configure app category mappings for each governance category used in policies.')
  }
  if (missingSens.length > 0) {
    recommendations.push('Configure DLP profile mappings for each sensitivity level used in policies.')
  }
  if (warnings.length > 0) {
    recommendations.push('Verify configured mappings in the Netskope console and mark them as verified.')
  }

  score = Math.max(0, Math.min(100, score))

  const status: ReadinessCheckResult['status'] =
    score >= 80 && critical_gaps.length === 0 ? 'ready'
    : score >= 40 ? 'partial'
    : 'not_ready'

  return {
    score,
    status,
    critical_gaps,
    warnings,
    recommendations,
    mapping_summary: {
      app_categories:         appCatSummary,
      dlp_profiles:           dlpSummary,
      labels:                 labelSummary,
      notification_templates: notifSummary,
    },
  }
}
