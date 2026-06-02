import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { validateNeutralPolicy, isTranslationReady } from '@/lib/genai/npj-schema'
import { extractAlwaysBlockProfiles, transposeNpjs } from '@/lib/genai/netskope/transpose'
import { buildTopology } from '@/lib/genai/netskope/topology'
import { LIMITATIONS, INLINE_FILE_SIZE_LIMIT_MB } from '@/lib/genai/netskope/limitations'
import type { NpjInput } from '@/lib/genai/netskope/transpose'
import type { SkippedPolicy } from '@/lib/genai/netskope/types'
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
  const [{ data: policies, error: policiesError }, { data: categories }, { data: coachingTemplates }] = await Promise.all([
    supabase
      .from('org_genai_policies')
      .select('id, name, policy_family, neutral_policy_json')
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
  ])

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

  // ── Step 2: Validate each NPJ (5 checks) ───────────────────────────────────
  const validNpjs:  NpjInput[]       = []
  const skipped:    SkippedPolicy[]  = []

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

    validNpjs.push({
      policy_id:           p.id,
      policy_name:         p.name,
      policy_family:       p.policy_family ?? '',
      risk_family_key:     rfKey,
      risk_family_label:   rfLabel,
      actions_by_category: abc,
      coaching_by_category: resolvedCoaching,
    })
  }

  // ── Steps 3–4: Transpose + extract always-block ────────────────────────────
  const alwaysBlockNpjs = extractAlwaysBlockProfiles(validNpjs)
  const alwaysBlockKeys = new Set(alwaysBlockNpjs.map(n => n.risk_family_key))
  const buckets         = transposeNpjs(validNpjs, alwaysBlockKeys)

  // ── Step 5–9: Build topology ───────────────────────────────────────────────
  const prohibitedCategory = (categories ?? []).find(c => c.system_tag === 'prohibited') ?? null

  const partial = buildTopology({
    buckets,
    alwaysBlockNpjs,
    prohibitedCategory,
    skippedCount: skipped.length,
  })

  const recommendation = {
    ...partial,
    skipped_policies:          skipped,
    limitations:               LIMITATIONS,
    inline_file_size_limit_mb: INLINE_FILE_SIZE_LIMIT_MB,
  }

  return <RecommendationClient recommendation={recommendation} />
}
