'use server'

import { createHash } from 'crypto'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { callData } from '@/lib/api-client.server'
import { logAuditEvent } from '@/lib/audit'
import { validateNeutralPolicy } from '@/lib/genai/npj-schema'
import type { ApprovalStatus, PolicyType, PolicyRule, ActionCode } from '@/lib/genai/types'
import {
  CONTENT_DETECTION_ROWS, RF_KEY, TAG_ALIAS,
  RF_DEFAULTS, RF_COACHING_DEFAULTS,
} from '@/lib/genai/control-matrix-rows'

function sortedStringify(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj)
  if (Array.isArray(obj)) return '[' + obj.map(sortedStringify).join(',') + ']'
  const sorted = Object.keys(obj as Record<string, unknown>).sort()
  return '{' + sorted.map(k => JSON.stringify(k) + ':' + sortedStringify((obj as Record<string, unknown>)[k])).join(',') + '}'
}

function computeNpjHash(npj: Record<string, unknown>): string {
  const stable = sortedStringify({ scope: npj.scope, content: npj.content, decision: npj.decision })
  return createHash('sha256').update(stable).digest('hex')
}

export interface PolicyFields {
  name?:             string
  description?:      string
  policy_type?:      PolicyType
  category_id?:      string | null
  approval_status?:  ApprovalStatus
  policy_owner?:     string
  technical_owner?:  string
  effective_date?:   string | null
  review_date?:      string | null
  next_review_date?: string | null
  notes?:            string
  is_active?:        boolean
  priority?:         number
  scope_all_apps?:   boolean
  scope_app_ids?:    string[]
  rules?:            PolicyRule[]
  identity_context?: string[] | null
  // migration 052
  policy_family?:             string | null
  generated_from?:            string | null
  data_classification_label?: string | null
  primary_action?:            ActionCode | null
  fallback_action?:           ActionCode | null
  coaching_template_id?:      string | null
  vendor_translation_status?: 'pending' | 'translated' | 'verified' | 'not-applicable' | 'deferred'
  required_dependencies?:     string[]
  test_status?:               'untested' | 'in-progress' | 'passed' | 'failed'
  // neutral policy json — source of truth for structured policies
  neutral_policy_json?:       Record<string, unknown>
  neutral_policy_hash?:       string | null
  neutral_policy_version?:    string | null
  // migration 079–080 — policy source model
  policy_source?:              'recommended' | 'manual'
  is_customized?:              boolean
  policy_key?:                 string | null
  matrix_basis?:               'default' | 'customized' | null
  last_synced_from_matrix_at?: string | null
}

export async function upsertPolicy(
  id: string | null,
  fields: PolicyFields,
): Promise<{ error?: string; id?: string }> {
  const user = await requireRole('analyst')
  const supabase = await createClient()

  // Server-side NPJ validation — never trust client-side alone
  if (fields.neutral_policy_json != null) {
    const result = validateNeutralPolicy(fields.neutral_policy_json)
    if (!result.valid) {
      return { error: `Invalid neutral policy: ${result.errors.join('; ')}` }
    }
    if (fields.neutral_policy_hash === undefined) {
      fields = {
        ...fields,
        neutral_policy_hash:    computeNpjHash(fields.neutral_policy_json),
        neutral_policy_version: '1.0',
      }
    }
  }

  const payload = {
    org_id:     user.orgId,
    updated_at: new Date().toISOString(),
    ...fields,
    ...(id ? { id } : {}),
  }

  const { data, error } = id
    ? await supabase.from('org_genai_policies').upsert(payload, { onConflict: 'id' }).select('id').maybeSingle()
    : await supabase.from('org_genai_policies').insert(payload).select('id').maybeSingle()

  if (error) return { error: error.message }
  revalidatePath('/genai-controls/policies')
  return { id: (data as { id: string } | null)?.id }
}

// ── Policy Coverage Analyzer ──────────────────────────────────────────────────

export type CoverageType =
  | 'duplicate'       // all dimensions match exactly
  | 'already_covered' // active policy, same or stricter, full coverage
  | 'conflict'        // same scope/conditions but incompatible action (allow vs enforce)
  | 'inactive_match'  // matching but policy is inactive
  | 'draft_match'     // matching draft exists

export interface CoverageMatch {
  id:           string
  name:         string
  explanation:  string
  coverageType: CoverageType
  policyState:  'active' | 'inactive' | 'draft'
}

export interface CoverageResult {
  hasCoverage: boolean
  hasConflict: boolean
  matches:     CoverageMatch[]
}

type NpjCategory  = { id: string; system_tag: string | null; name: string }
type NpjCondition = { type: string; sensitivity?: string; risk_family?: string; label_id?: string }
type NpjDecision  = { mode: string; require_acknowledgement?: boolean; require_justification?: boolean }
type NpjShape     = {
  intent?:    string
  policy_family?: string | null
  scope?:     { app_categories?: NpjCategory[]; activities?: string[]; users?: string[]; groups?: string[] }
  content?:   { conditions?: NpjCondition[] }
  decision?:  NpjDecision
}

const ACTION_RANK: Record<string, number> = { allow: 1, monitor: 2, alert: 3, coach: 4, block: 5 }

function categoryScopeCovers(
  existing: NpjCategory[] | undefined,
  proposed: NpjCategory[] | undefined,
): boolean {
  if (!existing?.length) return true    // existing = all apps → covers any proposed scope
  if (!proposed?.length) return false   // proposed = all apps, existing = subset → does NOT cover
  return proposed.every(p =>
    existing.some(e => (e.system_tag && e.system_tag === p.system_tag) || e.id === p.id)
  )
}

function activitiesCover(existing: string[] | undefined, proposed: string[] | undefined): boolean {
  if (!existing?.length || !proposed?.length) return false
  return proposed.every(a => existing.includes(a))
}

function singleConditionCovers(existing: NpjCondition, proposed: NpjCondition): boolean {
  if (existing.type !== proposed.type) return false
  if (existing.type === 'data_type') {
    const eKey = existing.risk_family ?? existing.sensitivity
    const pKey = proposed.risk_family ?? proposed.sensitivity
    return eKey !== undefined && eKey === pKey
  }
  if (existing.type === 'classification_label') return existing.label_id === proposed.label_id
  if (existing.type === 'filename')            return existing.sensitivity === proposed.sensitivity
  return false
}

function conditionCovers(
  existing: NpjCondition[] | undefined,
  proposed: NpjCondition[] | undefined,
): boolean {
  if (!existing?.length) return true    // existing has no conditions = covers all content
  if (!proposed?.length) return false   // proposed covers all content, existing is a subset
  return proposed.every(p => existing.some(e => singleConditionCovers(e, p)))
}

function exactConditionMatch(a: NpjCondition[] | undefined, b: NpjCondition[] | undefined): boolean {
  if (!a?.length && !b?.length) return true
  if ((a?.length ?? 0) !== (b?.length ?? 0)) return false
  return conditionCovers(a, b) && conditionCovers(b, a)
}

function exactCategoryMatch(a: NpjCategory[] | undefined, b: NpjCategory[] | undefined): boolean {
  if (!a?.length && !b?.length) return true
  if ((a?.length ?? 0) !== (b?.length ?? 0)) return false
  return categoryScopeCovers(a, b) && categoryScopeCovers(b, a)
}

function getPolicyState(p: { is_active: boolean; approval_status: string }): 'active' | 'inactive' | 'draft' {
  if (!p.is_active)                   return 'inactive'
  if (p.approval_status === 'draft')  return 'draft'
  return 'active'
}

function buildExplanation(npj: NpjShape): string {
  const mode       = npj.decision?.mode ?? 'enforce'
  const activities = (npj.scope?.activities ?? []).join(', ') || 'all activities'
  const cats       = (npj.scope?.app_categories ?? []).map(c => c.name).join(', ')
  const catStr     = cats ? `for ${cats}` : 'across all app categories'
  if (npj.intent === 'govern_app_access') {
    return `${mode === 'block' ? 'Blocks' : 'Controls'} app access (${activities}) ${catStr} — no content inspection.`
  }
  const conds = (npj.content?.conditions ?? [])
    .map(c => (c as Record<string,unknown>).name as string ?? c.sensitivity ?? c.type)
    .filter(Boolean)
    .join(', ')
  return `${mode}s ${conds || 'matching content'} on ${activities} ${catStr}.`
}

export async function checkPolicyCoverage(
  proposedNpj: Record<string, unknown>,
): Promise<CoverageResult> {
  const user     = await requireRole('analyst')
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('org_genai_policies')
    .select('id, name, is_active, approval_status, neutral_policy_json, policy_family')
    .eq('org_id', user.orgId)
    .not('neutral_policy_json', 'is', null)

  const proposed = proposedNpj as NpjShape
  const matches: CoverageMatch[] = []

  for (const row of (existing ?? [])) {
    const npj = row.neutral_policy_json as NpjShape | null
    if (!npj?.intent || !npj?.decision || !proposed.intent || !proposed.decision) continue

    // V1: skip if either side has non-empty user/group scope (can't determine coverage safely)
    const existingHasUserScope = (npj.scope?.users?.length ?? 0) > 0 || (npj.scope?.groups?.length ?? 0) > 0
    const proposedHasUserScope = (proposed.scope?.users?.length ?? 0) > 0 || (proposed.scope?.groups?.length ?? 0) > 0
    if (existingHasUserScope || proposedHasUserScope) continue

    const existingRank = ACTION_RANK[npj.decision.mode]      ?? 0
    const proposedRank = ACTION_RANK[proposed.decision.mode] ?? 0
    const state        = getPolicyState({ is_active: row.is_active as boolean, approval_status: row.approval_status as string })

    // 1. Exact duplicate — all 7 dimensions
    const isExactDuplicate =
      npj.intent === proposed.intent &&
      npj.decision.mode === proposed.decision.mode &&
      !!npj.decision.require_acknowledgement === !!proposed.decision.require_acknowledgement &&
      !!npj.decision.require_justification   === !!proposed.decision.require_justification &&
      exactCategoryMatch(npj.scope?.app_categories, proposed.scope?.app_categories) &&
      activitiesCover(npj.scope?.activities, proposed.scope?.activities) &&
      activitiesCover(proposed.scope?.activities, npj.scope?.activities) &&
      exactConditionMatch(npj.content?.conditions, proposed.content?.conditions) &&
      (!row.policy_family || !proposed.policy_family || row.policy_family === proposed.policy_family)

    if (isExactDuplicate) {
      matches.push({ id: row.id as string, name: row.name as string, coverageType: 'duplicate', policyState: state, explanation: buildExplanation(npj) })
      continue
    }

    // 2. Conflict — same scope/conditions, incompatible action direction
    const scopeMatches =
      categoryScopeCovers(npj.scope?.app_categories, proposed.scope?.app_categories) &&
      categoryScopeCovers(proposed.scope?.app_categories, npj.scope?.app_categories)
    const conditionsMatch =
      npj.intent === 'govern_app_access'
        ? true
        : exactConditionMatch(npj.content?.conditions, proposed.content?.conditions)

    const isConflict =
      scopeMatches && conditionsMatch &&
      ((existingRank === 1 && proposedRank >= 3) || (existingRank >= 3 && proposedRank === 1))

    if (isConflict) {
      matches.push({ id: row.id as string, name: row.name as string, coverageType: 'conflict', policyState: state, explanation: buildExplanation(npj) })
      continue
    }

    // 3. Coverage — existing must be same or stricter, scope/activities/conditions must cover proposed
    if (existingRank < proposedRank) continue
    if (!categoryScopeCovers(npj.scope?.app_categories, proposed.scope?.app_categories)) continue
    if (!activitiesCover(npj.scope?.activities, proposed.scope?.activities)) continue
    if (npj.intent !== 'govern_app_access' && proposed.intent !== 'govern_app_access') {
      if (!conditionCovers(npj.content?.conditions, proposed.content?.conditions)) continue
    }

    const coverageType: CoverageType =
      state === 'active'   ? 'already_covered' :
      state === 'draft'    ? 'draft_match'      :
                             'inactive_match'

    matches.push({ id: row.id as string, name: row.name as string, coverageType, policyState: state, explanation: buildExplanation(npj) })
  }

  return {
    hasCoverage: matches.some(m => m.coverageType !== 'conflict'),
    hasConflict: matches.some(m => m.coverageType === 'conflict'),
    matches,
  }
}

export async function duplicatePolicy(id: string): Promise<{ error?: string }> {
  const user = await requireRole('analyst')
  const supabase = await createClient()

  const { data, error: fetchErr } = await supabase
    .from('org_genai_policies')
    .select('*')
    .eq('id', id)
    .eq('org_id', user.orgId)
    .single()

  if (fetchErr || !data) return { error: fetchErr?.message ?? 'Not found' }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _id, created_at: _ca, updated_at: _ua, ...rest } = data as Record<string, unknown>

  const { error } = await supabase
    .from('org_genai_policies')
    .insert({
      ...rest,
      org_id:          user.orgId,
      name:            `${String(rest.name ?? '')} (copy)`,
      approval_status: 'draft',
      is_active:       false,
      // Reset provenance — the copy is a manual policy
      policy_source:   'manual',
      is_customized:   false,
      policy_key:      null,
      matrix_basis:    null,
      updated_at:      new Date().toISOString(),
    })

  if (error) return { error: error.message }
  revalidatePath('/genai-controls/policies')
  return {}
}

export async function deletePolicy(id: string): Promise<{ error?: string }> {
  const user = await requireRole('analyst')
  const supabase = await createClient()

  const { error } = await supabase
    .from('org_genai_policies')
    .delete()
    .eq('id', id)
    .eq('org_id', user.orgId)

  if (error) return { error: error.message }
  revalidatePath('/genai-controls/policies')
  return {}
}

export async function togglePolicyActive(
  id: string,
  is_active: boolean,
): Promise<{ error?: string }> {
  const user = await requireRole('analyst')
  const supabase = await createClient()

  const { error } = await supabase
    .from('org_genai_policies')
    .update({ is_active, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('org_id', user.orgId)

  if (error) return { error: error.message }
  revalidatePath('/genai-controls/policies')
  return {}
}


export async function getPolicyPackJobStatus(jobId: string): Promise<{
  status:         string
  processedItems: number | null
  totalItems:     number | null
  error:          string | null
}> {
  await requireRole('admin')
  const data = await callData<{
    status:          string
    processed_items: number | null
    total_items:     number | null
    error:           string | null
  }>(`/api/jobs/${jobId}`)
  return {
    status:         data.status,
    processedItems: data.processed_items,
    totalItems:     data.total_items,
    error:          data.error,
  }
}

export async function generatePoliciesFromGovernance(): Promise<{ error?: string; jobId?: string }> {
  await requireRole('analyst')
  try {
    const result = await callData<{ jobId: string }>('/api/jobs', {
      method: 'POST',
      body:   { jobType: 'policy-compile', payload: {} },
    })
    revalidatePath('/genai-controls/policies')
    return { jobId: result.jobId }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to start policy generation job.' }
  }
}

export async function logPolicyChangeEvent(params: {
  policyId:       string
  changeType:     string
  sourceLayer:    string
  proposedChange: Record<string, unknown>
  affectedCells:  string[]
  oldHash:        string | null
  compileJobId:   string | null
}): Promise<void> {
  const user = await requireRole('analyst')
  void logAuditEvent({
    action:      'policy.change_applied',
    entity_type: 'org_genai_policies',
    entity_id:   params.policyId,
    details: {
      change_type:     params.changeType,
      source_layer:    params.sourceLayer,
      proposed_change: params.proposedChange,
      affected_cells:  params.affectedCells,
      compile_job_id:  params.compileJobId,
      old_policy_hash: params.oldHash,
    },
    org_id:  user.orgId,
    user_id: user.id,
  })
}

const ALLOWED_DIFF_KEYS: Set<keyof PolicyFields> = new Set([
  'name', 'description', 'policy_type', 'notes', 'is_active', 'priority',
  'scope_all_apps', 'scope_app_ids', 'rules', 'identity_context',
  'policy_family', 'data_classification_label', 'primary_action',
  'fallback_action', 'coaching_template_id', 'vendor_translation_status',
  'required_dependencies', 'test_status', 'review_date', 'next_review_date',
  'effective_date', 'neutral_policy_json', 'neutral_policy_hash', 'neutral_policy_version',
  'policy_source', 'is_customized', 'policy_key', 'matrix_basis', 'last_synced_from_matrix_at',
])

export async function applyPolicyDiff(diff: {
  policyId: string
  changes:  Record<string, unknown>
}): Promise<{ error?: string }> {
  const user    = await requireRole('analyst')
  const supabase = await createClient()

  const { data: policy, error: fetchErr } = await supabase
    .from('org_genai_policies')
    .select('id, org_id, approval_status, policy_source')
    .eq('id', diff.policyId)
    .eq('org_id', user.orgId)
    .maybeSingle()

  if (fetchErr) return { error: fetchErr.message }
  if (!policy)  return { error: 'Policy not found.' }

  // Recommended policies are read-only — managed by the Control Matrix
  if ((policy as Record<string, unknown>).policy_source === 'recommended') {
    return { error: 'Recommended policies are managed by the Control Matrix. Use "Refresh from Matrix" or "Duplicate as Manual" to make changes.' }
  }

  if (policy.approval_status === 'approved') {
    return { error: 'Cannot edit an approved policy. Create a new draft instead.' }
  }

  const sanitized: Partial<PolicyFields> = {}
  for (const [k, v] of Object.entries(diff.changes)) {
    if (ALLOWED_DIFF_KEYS.has(k as keyof PolicyFields)) {
      (sanitized as Record<string, unknown>)[k] = v
    }
  }

  if (Object.keys(sanitized).length === 0) {
    return { error: 'No valid fields to apply.' }
  }

  const result = await upsertPolicy(diff.policyId, sanitized)
  if (result.error) return result

  void logAuditEvent({
    action:      'policy_chat.diff_applied',
    entity_type: 'org_genai_policies',
    entity_id:   diff.policyId,
    details:     { changedFields: Object.keys(sanitized) },
    org_id:      user.orgId,
    user_id:     user.id,
  })

  return {}
}

// ── Recommended policy sync ───────────────────────────────────────────────────

function buildOverrideMap(overrides: { data_type: string; category_id: string; action_code: string; coaching_notification_id: string | null }[]) {
  return new Map(overrides.map(o => [`${o.data_type}::${o.category_id}`, o]))
}

function getScopeActivities(rfKey: string): string[] {
  if (rfKey === 'large_file_upload')      return ['upload']
  if (rfKey === 'general_usage_reminder') return ['browse', 'login', 'prompt_submit', 'upload']
  return ['prompt_submit', 'upload', 'post']
}

function computeFallbackMode(actions: Record<string, string>): string {
  // Normalize UI-only codes to canonical NPJ decision.mode values before ranking
  const vals = Object.values(actions).map(a =>
    a === 'coach-ack' || a === 'coach-just' ? 'coach' : a,
  )
  const ORDER = ['block', 'coach', 'alert', 'monitor', 'allow']
  return ORDER.find(a => vals.includes(a)) ?? 'block'
}

export async function syncRecommendedPolicies(): Promise<void> {
  const user     = await requireRole('analyst')
  const supabase = await createClient()

  const [
    { data: overrides },
    { data: categories },
    { data: notifications },
    { data: existingPolicies },
  ] = await Promise.all([
    supabase.from('org_control_matrix_overrides')
      .select('data_type, category_id, action_code, coaching_notification_id')
      .eq('org_id', user.orgId),
    supabase.from('org_genai_governance_categories')
      .select('id, system_tag, name').eq('org_id', user.orgId).eq('active', true).order('priority'),
    supabase.from('org_coaching_notifications')
      .select('id, name').eq('org_id', user.orgId),
    supabase.from('org_genai_policies')
      .select('policy_key, is_active, neutral_policy_json, vendor_translation_status, test_status')
      .eq('org_id', user.orgId)
      .eq('policy_source', 'recommended'),
  ])

  const existingMap = new Map(
    (existingPolicies ?? [])
      .filter((p): p is typeof p & { policy_key: string } => p.policy_key != null)
      .map(p => [p.policy_key, p])
  )

  const overrideMap = buildOverrideMap(overrides ?? [])
  const notifMap    = new Map((notifications ?? []).map(n => [n.name as string, n.id as string]))
  const now         = new Date().toISOString()

  // ── 1. Content detection rows — derived from CONTENT_DETECTION_ROWS ──────────
  for (const rowLabel of CONTENT_DETECTION_ROWS) {
    const rfKey = RF_KEY[rowLabel]
    if (!rfKey) continue
    const policy_key = `rf:${rfKey}`

    const actions_by_category:  Record<string, string>       = {}
    const coaching_by_category: Record<string, string | null> = {}
    let   hasOverride = false

    for (const cat of categories ?? []) {
      const tag    = TAG_ALIAS[cat.system_tag ?? ''] ?? cat.system_tag ?? ''
      const rowKey = `pp|rf:${rfKey}`
      const ov     = overrideMap.get(`${rowKey}::${cat.id}`)

      if (ov) {
        hasOverride = true
        actions_by_category[tag]  = ov.action_code
        coaching_by_category[tag] = ov.coaching_notification_id ?? null
      } else {
        actions_by_category[tag]  = RF_DEFAULTS[tag]?.[rfKey] ?? 'allow'
        const coachName = RF_COACHING_DEFAULTS[tag]?.[rfKey] ?? null
        coaching_by_category[tag] = coachName ? (notifMap.get(coachName) ?? null) : null
      }
    }

    const npj = {
      schema_version: '1.0',
      intent:         'prevent_exfiltration',
      policy_family:  'genai_content_detection',
      scope: { activities: getScopeActivities(rfKey) },
      content: {
        operator:   'any',
        conditions: [{
          type:            'data_type',
          risk_family_key: rfKey,      // stable slug — used for internal logic
          risk_family:     rowLabel,   // display name — used for human-readable output
        }],
      },
      decision: {
        mode:                    computeFallbackMode(actions_by_category),
        require_acknowledgement: false,
        require_justification:   false,
      },
      actions_by_category,
      coaching_by_category,
    }

    const matrix_basis      = (hasOverride ? 'customized' : 'default') as 'default' | 'customized'
    const defaultCoachingId = coaching_by_category['restricted_unassessed'] ?? null
    const existing          = existingMap.get(policy_key)
    const isNew             = !existing
    const npjChanged        = isNew || JSON.stringify(existing.neutral_policy_json) !== JSON.stringify(npj)

    const { error } = await supabase.from('org_genai_policies').upsert({
      org_id:               user.orgId,
      policy_key,
      policy_source:        'recommended',
      matrix_basis,
      last_synced_from_matrix_at: now,
      name:                 `${rowLabel} Policy`,
      description:          `Detects and enforces controls for ${rowLabel} data across all GenAI apps.`,
      generated_from:       'recommended',
      is_active:            isNew ? true : existing.is_active,
      approval_status:      'approved',
      policy_family:        'genai_content_detection',
      coaching_template_id: defaultCoachingId,
      neutral_policy_json:  npj,
      scope_all_apps:       true,
      scope_app_ids:        [],
      rules:                [],
      priority:             100,
      required_dependencies: [],
      vendor_translation_status: npjChanged ? 'pending'  : (existing?.vendor_translation_status ?? 'pending'),
      test_status:               npjChanged ? 'untested' : (existing?.test_status               ?? 'untested'),
      updated_at: now,
    }, { onConflict: 'org_id,policy_key' })

    if (error) console.error(`[syncRecommendedPolicies] ${policy_key}:`, error.message)
  }

  // ── 2. Prohibited app block — single govern_app_access policy ────────────────
  {
    const policy_key          = 'rf:prohibited_app_block'
    const actions_by_category = { prohibited: 'block' }
    const coaching_by_category: Record<string, string | null> = { prohibited: null }

    const npj = {
      schema_version: '1.0',
      intent:         'govern_app_access',
      policy_family:  'genai_app_access',
      scope: {
        activities:     ['browse', 'login'],
        app_categories: [{ system_tag: 'prohibited', name: 'Prohibited GenAI' }],
      },
      content:  { operator: 'any', conditions: [] },
      decision: { mode: 'block', require_acknowledgement: false, require_justification: false },
      actions_by_category,
      coaching_by_category,
    }

    const existing   = existingMap.get(policy_key)
    const isNew      = !existing
    const npjChanged = isNew || JSON.stringify(existing.neutral_policy_json) !== JSON.stringify(npj)

    const { error } = await supabase.from('org_genai_policies').upsert({
      org_id:               user.orgId,
      policy_key,
      policy_source:        'recommended',
      matrix_basis:         'default',
      last_synced_from_matrix_at: now,
      name:                 'Prohibited GenAI App Block',
      description:          'Blocks access to all GenAI apps classified as Prohibited.',
      generated_from:       'recommended',
      is_active:            isNew ? true : existing.is_active,
      approval_status:      'approved',
      policy_family:        'genai_app_access',
      coaching_template_id: null,
      neutral_policy_json:  npj,
      scope_all_apps:       false,
      scope_app_ids:        [],
      rules:                [],
      priority:             10,
      required_dependencies: [],
      vendor_translation_status: npjChanged ? 'pending'  : (existing?.vendor_translation_status ?? 'pending'),
      test_status:               npjChanged ? 'untested' : (existing?.test_status               ?? 'untested'),
      updated_at: now,
    }, { onConflict: 'org_id,policy_key' })

    if (error) console.error('[syncRecommendedPolicies] prohibited_app_block:', error.message)
  }

  revalidatePath('/genai-controls/policies')
}

// policyId kept for API contract — future optimization could sync only that policy
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function refreshPolicyFromMatrix(policyId: string): Promise<{ error?: string }> {
  await syncRecommendedPolicies()
  return {}
}

export async function duplicatePolicyAsManual(policyId: string): Promise<{ newPolicyId?: string; error?: string }> {
  const user     = await requireRole('analyst')
  const supabase = await createClient()

  const { data, error: fetchErr } = await supabase
    .from('org_genai_policies')
    .select('*')
    .eq('id', policyId)
    .eq('org_id', user.orgId)
    .single()

  if (fetchErr || !data) return { error: fetchErr?.message ?? 'Not found' }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _id, created_at: _ca, updated_at: _ua, ...rest } = data as Record<string, unknown>

  const { data: newRow, error } = await supabase
    .from('org_genai_policies')
    .insert({
      ...rest,
      org_id:          user.orgId,
      name:            `Copy of ${String(rest.name ?? '')}`,
      policy_source:   'manual',
      policy_key:      null,
      matrix_basis:    null,
      last_synced_from_matrix_at: null,
      is_customized:   false,
      is_active:       false,
      approval_status: 'draft',
      updated_at:      new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error) return { error: error.message }
  revalidatePath('/genai-controls/policies')
  return { newPolicyId: (newRow as { id: string }).id }
}
