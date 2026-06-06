import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { validateNeutralPolicy, isTranslationReady } from '@/lib/genai/npj-schema'
import { extractAlwaysBlockProfiles, transposeNpjs } from '@/lib/genai/netskope/transpose'
import { buildTopology } from '@/lib/genai/netskope/topology'
import { generateTopologyOptions } from '@/lib/genai/netskope/options'
import { LIMITATIONS, INLINE_FILE_SIZE_LIMIT_MB } from '@/lib/genai/netskope/limitations'
import { TAG_ALIAS } from '@/lib/genai/control-matrix-rows'
import { isScopedNpj, resolveNpjScope, buildScopedPolicies } from '@/lib/genai/netskope/scoped'
import type { NpjInput } from '@/lib/genai/netskope/transpose'
import type { SkippedPolicy, ScopedNpjInput, NetskopePolicy, NetskopeProfileEntry, NpjProfileType } from '@/lib/genai/netskope/types'
import { RecommendationClient } from './_components/recommendation-client'

const SUPPORTED_FAMILIES = new Set([
  'genai_content_detection',
  'genai_label_detection',
  'genai_filename',
  'genai_filetype',
])

export default async function NetskopeRecommendationPage() {
  const user     = await requireRole('analyst')
  const supabase = await createClient()

  // ── Step 1: Fetch data in parallel ─────────────────────────────────────────
  const [
    { data: policies, error: policiesError },
    { data: categories },
    { data: coachingTemplates },
    { data: manualPolicyRows },
    { data: appCatalog },
  ] = await Promise.all([
    supabase
      .from('org_genai_policies')
      .select('id, name, policy_family, neutral_policy_json, updated_at')
      .eq('org_id', user.orgId)
      .eq('is_active', true)
      .eq('approval_status', 'approved')
      .in('policy_family', [...SUPPORTED_FAMILIES]),
    supabase
      .from('org_genai_governance_categories')
      .select('id, name, system_tag')
      .eq('org_id', user.orgId)
      .eq('active', true),
    supabase
      .from('org_coaching_notifications')
      .select('id, name, coach_label')
      .eq('org_id', user.orgId)
      .eq('is_active', true),
    // Manual / AI-generated policies — shown in their own section, not fed into the topology engine
    supabase
      .from('org_genai_policies')
      .select('id, name, policy_family, neutral_policy_json, priority')
      .eq('org_id', user.orgId)
      .eq('is_active', true)
      .eq('approval_status', 'approved')
      .eq('policy_source', 'manual'),
    // App catalog — used to resolve scope.apps IDs to display names in resolveNpjScope
    supabase
      .from('genai_apps')
      .select('app_id, app_name'),
  ])

  // Build app_id → app_name lookup map for scope.apps resolution in resolveNpjScope
  const appMap: Record<string, string> = Object.fromEntries(
    (appCatalog ?? []).map(a => [a.app_id as string, a.app_name as string])
  )

  // UUID → display name map for coaching templates
  const coachingNameMap = new Map<string, string>(
    (coachingTemplates ?? []).map(t => [
      t.id as string,
      (t.coach_label as string | null) ?? (t.name as string),
    ])
  )

  if (policiesError) {
    return (
      <div className="p-8 text-sm text-red-400">
        Failed to load policies: {policiesError.message}
      </div>
    )
  }

  // ── Step 2: Validate each NPJ (6 checks) + classify scoped vs default ────────
  const validNpjs:  NpjInput[]       = []
  const scopedNpjs: ScopedNpjInput[] = []
  const skipped:    SkippedPolicy[]  = []
  // Track policy IDs that were actually emitted by the scoped builder so the manual
  // conversion can skip only those — not every policy that looks scoped.
  // (A policy with scope.apps but an unsupported family is never in the first query
  //  and must still appear in the manual section.)
  const scopedEmittedIds = new Set<string>()

  for (const p of policies ?? []) {
    const npj = p.neutral_policy_json as Record<string, unknown> | null

    // Check 1: NPJ exists
    if (!npj || Object.keys(npj).length === 0) {
      skipped.push({ policy_id: p.id, policy_name: p.name, reason: 'Missing or empty NPJ', fix: 'Regenerate from Control Matrix' })
      continue
    }

    // Check 2: structural schema
    const schemaResult = validateNeutralPolicy(npj)
    if (!schemaResult.valid) {
      skipped.push({ policy_id: p.id, policy_name: p.name, reason: 'Invalid NPJ structure: ' + schemaResult.errors[0], fix: 'Visit Policy Editor — invalid NPJ structure' })
      continue
    }

    // Check 3: translation_ready
    if (!isTranslationReady(npj)) {
      skipped.push({ policy_id: p.id, policy_name: p.name, reason: 'NPJ has action/template conflicts (translation_ready: false)', fix: 'Visit Policy Editor — resolve action/template conflicts' })
      continue
    }

    // Check 4: actions_by_category
    const abc = npj.actions_by_category as Record<string, string> | undefined
    if (!abc || Object.keys(abc).length === 0) {
      skipped.push({ policy_id: p.id, policy_name: p.name, reason: 'No actions_by_category in NPJ', fix: 'Regenerate from Control Matrix' })
      continue
    }

    // Check 5: supported policy_family
    if (!SUPPORTED_FAMILIES.has(p.policy_family ?? '')) {
      skipped.push({ policy_id: p.id, policy_name: p.name, reason: `Policy family '${p.policy_family}' is not yet supported`, fix: 'Policy family not yet supported by recommendation engine' })
      continue
    }

    // Check 6: NPJ is not stale — provenance.generated_at must be >= updated_at
    const provenance = npj.provenance as Record<string, unknown> | undefined
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

    // Extract risk family info from NPJ
    const content = npj.content as { conditions?: Array<Record<string, unknown>> } | undefined
    const firstCond = content?.conditions?.[0]
    const rfKey   = (firstCond?.risk_family_key as string | undefined)
                  ?? (npj.policy_id as string | undefined)?.replace('rf:', '')
                  ?? ''
    const rfLabel = (firstCond?.risk_family as string | undefined)
                  ?? p.name

    if (!rfKey) {
      skipped.push({ policy_id: p.id, policy_name: p.name, reason: 'Cannot determine risk_family_key from NPJ', fix: 'Regenerate from Control Matrix' })
      continue
    }

    // Resolve coaching UUID → display name before passing to engine
    const rawCoaching = npj.coaching_by_category as Record<string, string | null> | undefined
    const resolvedCoaching: Record<string, string | null> | undefined = rawCoaching
      ? Object.fromEntries(
          Object.entries(rawCoaching).map(([cat, id]) => [
            cat,
            id ? (coachingNameMap.get(id) ?? id) : null,
          ])
        )
      : undefined

    // Phase 4: extract scope.activities from the NPJ to carry through the recommendation engine.
    const npjScope = npj.scope as Record<string, unknown> | undefined
    const sourceActivities = Array.isArray(npjScope?.activities)
      ? (npjScope!.activities as string[])
      : undefined

    // ── Phase 3: Classify scoped vs default before pushing to category buckets ──
    if (isScopedNpj(npj)) {
      // scope.apps may list multiple specific apps — expand into one ScopedNpjInput per app
      // so each gets its own Netskope cloud_app policy instead of silently targeting only the first.
      const npjScopeApps = Array.isArray(npjScope?.apps) ? (npjScope!.apps as string[]) : []
      const appIdsToExpand = npjScopeApps.length > 1 ? npjScopeApps : [null]

      let anyResolved = false
      for (const singleAppId of appIdsToExpand) {
        // When expanding multi-app, create a single-app NPJ slice for each app ID.
        const npjForResolve = singleAppId
          ? { ...npj, scope: { ...(npj.scope as Record<string, unknown>), apps: [singleAppId] } }
          : npj
        const resolved = resolveNpjScope(npjForResolve as Record<string, unknown>, appMap)
        if (resolved) {
          scopedNpjs.push({
            policy_id:              p.id,
            policy_name:            p.name,
            policy_family:          p.policy_family ?? '',
            risk_family_key:        rfKey,
            risk_family_label:      rfLabel,
            actions_by_category:    abc,
            coaching_by_category:   resolvedCoaching,
            source:                 resolved.source,
            destination:            resolved.destination,
            destination_defaulted:  resolved.destinationDefaulted,
            source_activities:      sourceActivities,
            // Phase 4.5: source identity exclusions (User / User Group / OU narrowing).
            ...(resolved.exclusions.length > 0 && { source_exclusions: resolved.exclusions }),
          })
          anyResolved = true
        }
      }
      if (anyResolved) {
        scopedEmittedIds.add(p.id)  // record so manual path can skip the exact same ID
        continue  // exclude from category buckets
      }
      // All resolveNpjScope calls returned null → fall through to validNpjs
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
  // Build valid category tag set from DB so drift keys in AI/blank policy NPJs
  // (created or edited after a category was renamed/deleted) are silently dropped.
  const validCategoryTags = new Set(
    (categories ?? [])
      .map(c => TAG_ALIAS[c.system_tag as string ?? ''] ?? c.system_tag as string ?? '')
      .filter(Boolean)
  )

  const alwaysBlockNpjs = extractAlwaysBlockProfiles(validNpjs)
  const alwaysBlockKeys = new Set(alwaysBlockNpjs.map(n => n.risk_family_key))
  const buckets         = transposeNpjs(validNpjs, alwaysBlockKeys, validCategoryTags)

  // ── Step 5–9: Build topology ───────────────────────────────────────────────
  const prohibitedCategory = (categories ?? []).find(c => c.system_tag === 'prohibited') ?? null

  // Build system_tag → display name map so custom category policies get readable names
  const categoryNameMap: Record<string, string> = Object.fromEntries(
    (categories ?? [])
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

  // ── Manual policy conversion ────────────────────────────────────────────────
  // flatMap because a multi-app scoped NPJ (scope.apps.length > 1) expands into one policy per app.
  const manual_policies: NetskopePolicy[] = (manualPolicyRows ?? [])
    .flatMap((p, idx) => {
      const npj = p.neutral_policy_json as Record<string, unknown> | null
      if (!npj || typeof npj !== 'object') return []

      // Skip policies that were already emitted by the scoped path (supported family + scoped NPJ).
      // Unsupported-family scoped policies (e.g. genai_app_access) are never in the first query
      // so scopedEmittedIds will not contain their IDs — they must be handled here.
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
      // Governance category name (e.g. "Approved & Supported") is a CCI App Tag in Netskope,
      // NOT the primary Category destination. Primary is always "Generative AI".
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

      // ── Scoped NPJ: use resolveNpjScope for accurate destination/source ──
      // This handles any policy that isn't in the first query's supported families but still
      // has a specific scope (scope.apps, app_instances, source identity, etc.).
      // Multi-app NPJs are expanded: one NetskopePolicy per app, same as the scoped path.
      if (isScopedNpj(npj)) {
        const scopeAppsArr    = Array.isArray(scope.apps) ? (scope.apps as string[]) : []
        const appIdsToExpand  = scopeAppsArr.length > 1 ? scopeAppsArr : [null]

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
                // resolveNpjScope returned null — fall back to broad category rather than dropping
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

      // ── Unscoped NPJ: broad category destination (existing behaviour) ──
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

  const recommendation = {
    ...partial,
    topology_options,
    scoped_policies,
    manual_policies,
    strategy_overrides:        null,
    skipped_policies:          skipped,
    limitations:               LIMITATIONS,
    inline_file_size_limit_mb: INLINE_FILE_SIZE_LIMIT_MB,
  }

  return <RecommendationClient recommendation={recommendation} orgCategories={categories ?? []} />
}
