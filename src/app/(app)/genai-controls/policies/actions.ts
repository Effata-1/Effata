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
  neutral_policy_json?:       Record<string, unknown> | null
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
  changes:  Record<string, never>
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
