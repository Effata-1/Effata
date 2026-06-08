import 'server-only'

import { createClient }                                from '@/lib/supabase/server'
import { validateNeutralPolicy, isTranslationReady }  from '@/lib/genai/npj-schema'
import { extractAlwaysBlockProfiles, transposeNpjs }  from '@/lib/genai/netskope/transpose'
import { buildTopology }                              from '@/lib/genai/netskope/topology'
import { generateTopologyOptions }                    from '@/lib/genai/netskope/options'
import { LIMITATIONS, INLINE_FILE_SIZE_LIMIT_MB }    from '@/lib/genai/netskope/limitations'
import { TAG_ALIAS }                                  from '@/lib/genai/control-matrix-rows'
import { isScopedNpj, resolveNpjScope, buildScopedPolicies } from '@/lib/genai/netskope/scoped'
import { lintAllPolicies }                            from '@/lib/genai/lint'
import type { NpjInput }                              from '@/lib/genai/netskope/transpose'
import type { SkippedPolicy, ScopedNpjInput, NetskopePolicy, NetskopeProfileEntry, NpjProfileType, NetskopeRecommendation } from '@/lib/genai/netskope/types'
import type { GenAIPolicy }                           from '@/lib/genai/types'

// ── Constants ─────────────────────────────────────────────────────────────────

const SUPPORTED_FAMILIES = new Set([
  'genai_content_detection',
  'genai_label_detection',
  'genai_filename',
  'genai_filetype',
])

const DEFAULT_SENSITIVITY_LABELS = [
  { id: 'default-public',            name: 'Public',            source: 'default' as const },
  { id: 'default-internal',          name: 'Internal',          source: 'default' as const },
  { id: 'default-confidential',      name: 'Confidential',      source: 'default' as const },
  { id: 'default-highly-confidential', name: 'Highly Confidential', source: 'default' as const },
  { id: 'default-secret',            name: 'Secret',            source: 'default' as const },
]

// ── Return type ───────────────────────────────────────────────────────────────

export interface OrgCategory {
  id:             string
  name:           string
  system_tag:     string | null
  access_posture: string
  priority:       number
}

export interface RecommendationResult {
  recommendation:   NetskopeRecommendation
  categories:       OrgCategory[]
  appCounts: {
    prohibited:             number
    approvedSupported:      number
    approvedWithConditions: number
    restricted:             number
  }
  counts: {
    coachingTemplates:       number
    activeCoachingTemplates: number
    manualPolicies:          number
    scopedPolicies:          number
    lintWarnings:            number
  }
  sensitivityLabels: Array<{ id: string; name: string; source: 'org' | 'default' }>
}

// ── Main helper ───────────────────────────────────────────────────────────────

export async function getNetskopeRecommendationForOrg(orgId: string): Promise<RecommendationResult> {
  const supabase = await createClient()

  // ── Step 1: Fetch data in parallel (8 queries) ────────────────────────────
  // Queries 1 and 2 are critical — errors there produce silently wrong results.
  // All other queries are non-critical: empty/errored results degrade gracefully.
  const [
    policiesResult,
    categoriesResult,
    { data: coachingTemplatesRaw },
    { data: manualPolicyRows },
    { data: appCatalog },
    { data: classificationRows },
    { data: sensitivityLabelRows },
    { data: lintPoliciesRaw },
  ] = await Promise.all([
    // 1. NPJ policies for topology engine — CRITICAL
    supabase
      .from('org_genai_policies')
      .select('id, name, policy_family, neutral_policy_json, updated_at')
      .eq('org_id', orgId)
      .eq('is_active', true)
      .eq('approval_status', 'approved')
      .in('policy_family', [...SUPPORTED_FAMILIES]),

    // 2. Governance categories — CRITICAL (access_posture + priority needed for architecture)
    supabase
      .from('org_genai_governance_categories')
      .select('id, name, system_tag, access_posture, priority')
      .eq('org_id', orgId)
      .eq('active', true)
      .order('priority'),

    // 3. Coaching templates — non-critical, graceful empty
    supabase
      .from('org_coaching_notifications')
      .select('id, name, coach_label, is_active')
      .eq('org_id', orgId),

    // 4. Manual policies — non-critical, graceful empty
    supabase
      .from('org_genai_policies')
      .select('id, name, policy_family, neutral_policy_json, priority')
      .eq('org_id', orgId)
      .eq('is_active', true)
      .eq('approval_status', 'approved')
      .eq('policy_source', 'manual'),

    // 5. App catalog for scope resolution — non-critical, graceful empty
    supabase
      .from('genai_apps')
      .select('app_id, app_name'),

    // 6. App classifications for appCounts — non-critical, defaults to 0
    supabase
      .from('genai_customer_classifications')
      .select('customer_classification')
      .eq('org_id', orgId)
      .neq('customer_classification', 'unknown'),

    // 7. Sensitivity labels — non-critical, falls back to 5 defaults
    supabase
      .from('org_customer_sensitivity_labels')
      .select('id, display_name')
      .eq('org_id', orgId)
      .eq('active', true)
      .order('priority'),

    // 8. Full policy fields for lint — non-critical, defaults to 0 warnings
    supabase
      .from('org_genai_policies')
      .select(
        'id, name, description, policy_type, primary_action, data_classification_label, ' +
        'approval_status, is_active, scope_all_apps, scope_app_ids, rules, policy_owner, ' +
        'next_review_date, neutral_policy_json, policy_source, policy_family, test_status, priority',
      )
      .eq('org_id', orgId),
  ])

  // ── Fail fast on critical query errors ────────────────────────────────────
  // These two queries underpin the entire recommendation. A Supabase error here
  // should surface as a real failure rather than silently producing empty data.
  if (policiesResult.error) {
    throw new Error(`getNetskopeRecommendationForOrg: failed to load NPJ policies — ${policiesResult.error.message}`)
  }
  if (categoriesResult.error) {
    throw new Error(`getNetskopeRecommendationForOrg: failed to load governance categories — ${categoriesResult.error.message}`)
  }

  const policies     = policiesResult.data
  const categoriesRaw = categoriesResult.data

  // ── Build lookup maps ──────────────────────────────────────────────────────
  const appMap: Record<string, string> = Object.fromEntries(
    (appCatalog ?? []).map(a => [a.app_id as string, a.app_name as string])
  )

  const activeCoaching   = (coachingTemplatesRaw ?? []).filter(t => t.is_active)
  const coachingNameMap  = new Map<string, string>(
    (coachingTemplatesRaw ?? []).map(t => [
      t.id as string,
      (t.coach_label as string | null) ?? (t.name as string),
    ])
  )

  // ── App counts ────────────────────────────────────────────────────────────
  const countBy = (cls: string) =>
    (classificationRows ?? []).filter(c => c.customer_classification === cls).length
  const appCounts = {
    prohibited:             countBy('prohibited'),
    approvedSupported:      countBy('enterprise-approved'),
    approvedWithConditions: countBy('approved-with-conditions'),
    restricted:             countBy('permitted-with-restriction'),
  }

  // ── Sensitivity labels ────────────────────────────────────────────────────
  const sensitivityLabels: Array<{ id: string; name: string; source: 'org' | 'default' }> =
    (sensitivityLabelRows ?? []).length > 0
      ? (sensitivityLabelRows ?? []).map(l => ({ id: l.id as string, name: l.display_name as string, source: 'org' as const }))
      : DEFAULT_SENSITIVITY_LABELS

  // ── Categories ────────────────────────────────────────────────────────────
  const categories: OrgCategory[] = (categoriesRaw ?? []).map(c => ({
    id:             c.id as string,
    name:           c.name as string,
    system_tag:     c.system_tag as string | null,
    access_posture: (c.access_posture as string | null) ?? 'allow_dlp',
    priority:       (c.priority as number | null) ?? 999,
  }))

  // ── Step 2: Validate each NPJ + classify scoped vs default ────────────────
  const validNpjs:       NpjInput[]       = []
  const scopedNpjs:      ScopedNpjInput[] = []
  const skipped:         SkippedPolicy[]  = []
  const scopedEmittedIds = new Set<string>()

  for (const p of policies ?? []) {
    const npj = p.neutral_policy_json as Record<string, unknown> | null

    if (!npj || Object.keys(npj).length === 0) {
      skipped.push({ policy_id: p.id, policy_name: p.name, reason: 'Missing or empty NPJ', fix: 'Regenerate from Control Matrix' })
      continue
    }

    const schemaResult = validateNeutralPolicy(npj)
    if (!schemaResult.valid) {
      skipped.push({ policy_id: p.id, policy_name: p.name, reason: 'Invalid NPJ structure: ' + schemaResult.errors[0], fix: 'Visit Policy Editor — invalid NPJ structure' })
      continue
    }

    if (!isTranslationReady(npj)) {
      skipped.push({ policy_id: p.id, policy_name: p.name, reason: 'NPJ has action/template conflicts (translation_ready: false)', fix: 'Visit Policy Editor — resolve action/template conflicts' })
      continue
    }

    const abc = npj.actions_by_category as Record<string, string> | undefined
    if (!abc || Object.keys(abc).length === 0) {
      skipped.push({ policy_id: p.id, policy_name: p.name, reason: 'No actions_by_category in NPJ', fix: 'Regenerate from Control Matrix' })
      continue
    }

    if (!SUPPORTED_FAMILIES.has(p.policy_family ?? '')) {
      skipped.push({ policy_id: p.id, policy_name: p.name, reason: `Policy family '${p.policy_family}' is not yet supported`, fix: 'Policy family not yet supported by recommendation engine' })
      continue
    }

    const provenance  = npj.provenance as Record<string, unknown> | undefined
    const generatedAt = provenance?.generated_at as string | undefined
    const updatedAt   = p.updated_at as string | undefined
    if (generatedAt && updatedAt && generatedAt < updatedAt) {
      skipped.push({
        policy_id:   p.id,
        policy_name: p.name,
        reason:      `NPJ is outdated — policy was updated ${new Date(updatedAt).toLocaleDateString()} but NPJ was last compiled ${new Date(generatedAt).toLocaleDateString()}`,
        fix:         'Visit Policy Editor — recompile or refresh from Control Matrix',
      })
      continue
    }

    const content    = npj.content as { conditions?: Array<Record<string, unknown>> } | undefined
    const firstCond  = content?.conditions?.[0]
    const rfKey      = (firstCond?.risk_family_key as string | undefined)
                     ?? (npj.policy_id as string | undefined)?.replace('rf:', '')
                     ?? ''
    const rfLabel    = (firstCond?.risk_family as string | undefined) ?? p.name

    if (!rfKey) {
      skipped.push({ policy_id: p.id, policy_name: p.name, reason: 'Cannot determine risk_family_key from NPJ', fix: 'Regenerate from Control Matrix' })
      continue
    }

    const rawCoaching = npj.coaching_by_category as Record<string, string | null> | undefined
    const resolvedCoaching: Record<string, string | null> | undefined = rawCoaching
      ? Object.fromEntries(
          Object.entries(rawCoaching).map(([cat, id]) => [
            cat,
            id ? (coachingNameMap.get(id) ?? id) : null,
          ])
        )
      : undefined

    const npjScope        = npj.scope as Record<string, unknown> | undefined
    const sourceActivities = Array.isArray(npjScope?.activities)
      ? (npjScope!.activities as string[])
      : undefined

    if (isScopedNpj(npj)) {
      const npjScopeApps  = Array.isArray(npjScope?.apps) ? (npjScope!.apps as string[]) : []
      const appIdsToExpand = npjScopeApps.length > 1 ? npjScopeApps : [null]
      let anyResolved = false

      for (const singleAppId of appIdsToExpand) {
        const npjForResolve = singleAppId
          ? { ...npj, scope: { ...(npj.scope as Record<string, unknown>), apps: [singleAppId] } }
          : npj
        const resolved = resolveNpjScope(npjForResolve as Record<string, unknown>, appMap)
        if (resolved) {
          scopedNpjs.push({
            policy_id:             p.id,
            policy_name:           p.name,
            policy_family:         p.policy_family ?? '',
            risk_family_key:       rfKey,
            risk_family_label:     rfLabel,
            actions_by_category:   abc,
            coaching_by_category:  resolvedCoaching,
            source:                resolved.source,
            destination:           resolved.destination,
            destination_defaulted: resolved.destinationDefaulted,
            source_activities:     sourceActivities,
            ...(resolved.exclusions.length > 0 && { source_exclusions: resolved.exclusions }),
          })
          anyResolved = true
        }
      }
      if (anyResolved) {
        scopedEmittedIds.add(p.id)
        continue
      }
    }

    validNpjs.push({
      policy_id:            p.id,
      policy_name:          p.name,
      policy_family:        p.policy_family ?? '',
      risk_family_key:      rfKey,
      risk_family_label:    rfLabel,
      actions_by_category:  abc,
      coaching_by_category: resolvedCoaching,
      source_activities:    sourceActivities,
    })
  }

  // ── Steps 3–4: Transpose + extract always-block ────────────────────────────
  const validCategoryTags = new Set(
    (categoriesRaw ?? [])
      .map(c => TAG_ALIAS[c.system_tag as string ?? ''] ?? c.system_tag as string ?? '')
      .filter(Boolean)
  )

  const alwaysBlockNpjs = extractAlwaysBlockProfiles(validNpjs)
  const alwaysBlockKeys = new Set(alwaysBlockNpjs.map(n => n.risk_family_key))
  const buckets         = transposeNpjs(validNpjs, alwaysBlockKeys, validCategoryTags)

  // ── Steps 5–9: Build topology ──────────────────────────────────────────────
  const prohibitedCategory = (categoriesRaw ?? []).find(c => c.system_tag === 'prohibited') ?? null

  const categoryNameMap: Record<string, string> = Object.fromEntries(
    (categoriesRaw ?? [])
      .filter(c => c.system_tag)
      .map(c => [TAG_ALIAS[c.system_tag as string] ?? c.system_tag as string, c.name as string])
  )

  const partial = buildTopology({
    buckets,
    alwaysBlockNpjs,
    prohibitedCategory,
    skippedCount: skipped.length,
    categoryNameMap,
  })

  const topology_options = generateTopologyOptions(
    { buckets, alwaysBlockNpjs, prohibitedCategory, skippedCount: skipped.length, categoryNameMap },
    partial,
  )

  const scoped_policies = scopedNpjs.length > 0 ? buildScopedPolicies(scopedNpjs) : null

  // ── Manual policy conversion ───────────────────────────────────────────────
  const manual_policies: NetskopePolicy[] = (manualPolicyRows ?? [])
    .flatMap((p, idx) => {
      const npj = p.neutral_policy_json as Record<string, unknown> | null
      if (!npj || typeof npj !== 'object') return []
      if (scopedEmittedIds.has(p.id)) return []

      const scope      = (npj.scope as Record<string, unknown> | undefined) ?? {}
      const decision   = (npj.decision as Record<string, unknown> | undefined) ?? {}
      const content    = (npj.content as Record<string, unknown> | undefined) ?? {}
      const conds      = (content.conditions as Array<Record<string, unknown>> | undefined) ?? []
      const users      = (scope.users as string[] | undefined) ?? []
      const appCats    = (scope.app_categories as Array<Record<string, unknown>> | undefined) ?? []
      const activities = (scope.activities as string[] | undefined) ?? ['prompt_submit', 'upload']
      const action     = (decision.mode as string | undefined) ?? 'alert'
      const firstUser  = users.find(u => u !== 'All Users')
      const destCciTag = appCats[0]?.name as string | undefined

      const profiles: NetskopeProfileEntry[] = conds.length > 0
        ? conds.map(cond => {
            const pType: NpjProfileType =
              cond.type === 'data_type'             ? 'content_detection'  :
              p.policy_family === 'genai_filename'  ? 'filename_detection' :
                                                      'classification_label'
            const pName =
              (cond.risk_family as string | undefined) ??
              (cond.label_name as string | undefined)  ??
              (cond.sensitivity as string | undefined) ??
              p.name
            return { profile: pName, profile_type: pType, profile_action: action, coaching_template: null }
          })
        : [{ profile: p.name, profile_type: 'content_detection' as NpjProfileType, profile_action: action, coaching_template: null }]

      const basePriority = (typeof p.priority === 'number' && p.priority >= 100) ? p.priority : 500 + idx * 10

      if (isScopedNpj(npj)) {
        const scopeAppsArr   = Array.isArray(scope.apps) ? (scope.apps as string[]) : []
        const appIdsToExpand = scopeAppsArr.length > 1 ? scopeAppsArr : [null]

        return appIdsToExpand.flatMap((singleAppId, expandIdx): NetskopePolicy[] => {
          const npjForResolve = singleAppId
            ? { ...npj, scope: { ...scope, apps: [singleAppId] } }
            : npj
          const resolved = resolveNpjScope(npjForResolve as Record<string, unknown>, appMap)

          const destination = resolved
            ? {
                strategy:        resolved.destination.type,
                tag_or_category: resolved.destination.value,
                ...(resolved.destination.cci_app_tag != null && { cci_app_tag: resolved.destination.cci_app_tag }),
                note: resolved.destination.app && resolved.destination.instance
                  ? `${resolved.destination.app} — ${resolved.destination.instance} instance`
                  : null,
              }
            : {
                strategy:        'app_category' as const,
                tag_or_category: 'Generative AI',
                ...(destCciTag ? { cci_app_tag: destCciTag } : {}),
                note:            null,
              }

          const source = resolved
            ? { type: resolved.source.type, value: resolved.source.value }
            : firstUser
              ? { type: 'user_group' as const, value: firstUser }
              : { type: 'all_users' as const, value: null }

          return [{
            priority:    basePriority + expandIdx,
            policy_key:  singleAppId ? `manual:${p.id}:${singleAppId}` : `manual:${p.id}`,
            name:        p.name,
            policy_type: 'realtime_protection' as const,
            destination,
            source,
            activities,
            profiles,
            no_match_action:            null,
            continue_policy_evaluation: null,
            notification:               null,
          }]
        })
      }

      return [{
        priority:    basePriority,
        policy_key:  `manual:${p.id}`,
        name:        p.name,
        policy_type: 'realtime_protection' as const,
        destination: {
          strategy:        'app_category',
          tag_or_category: 'Generative AI',
          ...(destCciTag ? { cci_app_tag: destCciTag } : {}),
          note:            null,
        },
        source:      firstUser
          ? { type: 'user_group' as const, value: firstUser }
          : { type: 'all_users' as const, value: null },
        activities,
        profiles,
        no_match_action:            null,
        continue_policy_evaluation: null,
        notification:               null,
      }]
    })

  // ── Assemble final recommendation ─────────────────────────────────────────
  const recommendation: NetskopeRecommendation = {
    ...partial,
    topology_options,
    scoped_policies,
    manual_policies,
    strategy_overrides:        null,
    skipped_policies:          skipped,
    limitations:               LIMITATIONS,
    inline_file_size_limit_mb: INLINE_FILE_SIZE_LIMIT_MB,
  }

  // ── Counts ────────────────────────────────────────────────────────────────
  const lintIssues   = lintAllPolicies(((lintPoliciesRaw ?? []) as unknown[]) as GenAIPolicy[])
  const lintWarnings = lintIssues.filter(i => i.severity === 'warning' || i.severity === 'error').length

  const counts = {
    coachingTemplates:       (coachingTemplatesRaw ?? []).length,
    activeCoachingTemplates: activeCoaching.length,
    manualPolicies:          manual_policies.length,
    scopedPolicies:          scoped_policies?.policies?.length ?? 0,
    lintWarnings,
  }

  return { recommendation, categories, appCounts, counts, sensitivityLabels }
}
