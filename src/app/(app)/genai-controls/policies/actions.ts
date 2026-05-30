'use server'

import { createHash } from 'crypto'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { callData } from '@/lib/api-client.server'
import { logAuditEvent } from '@/lib/audit'
import { validateNeutralPolicy } from '@/lib/genai/npj-schema'
import type { ApprovalStatus, PolicyType, PolicyRule, ActionCode } from '@/lib/genai/types'

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
type NpjCondition = { type: string; sensitivity?: string; label_id?: string }
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
  if (existing.type === 'data_type')           return existing.sensitivity === proposed.sensitivity
  if (existing.type === 'classification_label') return existing.label_id    === proposed.label_id
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
])

export async function applyPolicyDiff(diff: {
  policyId: string
  changes:  Record<string, unknown>
}): Promise<{ error?: string }> {
  const user    = await requireRole('analyst')
  const supabase = await createClient()

  const { data: policy, error: fetchErr } = await supabase
    .from('org_genai_policies')
    .select('id, org_id, approval_status')
    .eq('id', diff.policyId)
    .eq('org_id', user.orgId)
    .maybeSingle()

  if (fetchErr) return { error: fetchErr.message }
  if (!policy)  return { error: 'Policy not found.' }

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
