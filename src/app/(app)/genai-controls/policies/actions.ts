'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { callData } from '@/lib/api-client.server'
import { logAuditEvent } from '@/lib/audit'
import type { ApprovalStatus, PolicyType, PolicyRule, ActionCode } from '@/lib/genai/types'

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
  vendor_translation_status?: 'pending' | 'translated' | 'verified' | 'not-applicable'
  required_dependencies?:     string[]
  test_status?:               'untested' | 'in-progress' | 'passed' | 'failed'
}

export async function upsertPolicy(
  id: string | null,
  fields: PolicyFields,
): Promise<{ error?: string }> {
  const user = await requireRole('analyst')
  const supabase = await createClient()

  const payload = {
    org_id:     user.orgId,
    updated_at: new Date().toISOString(),
    ...fields,
    ...(id ? { id } : {}),
  }

  const { error } = id
    ? await supabase.from('org_genai_policies').upsert(payload, { onConflict: 'id' })
    : await supabase.from('org_genai_policies').insert(payload)

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

export async function requestPolicyPackJob(): Promise<{ jobId: string }> {
  await requireRole('admin')
  const result = await callData<{ jobId: string }>('/api/jobs', {
    method: 'POST',
    body:   { jobType: 'policy-pack', payload: {} },
  })
  return { jobId: result.jobId }
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

// Action restrictiveness ranking — higher = more restrictive
const ACTION_RANK: Record<ActionCode, number> = {
  'not-set':    0,
  'allow':      1,
  'monitor':    2,
  'alert':      3,
  'coach':      4,
  'coach-ack':  4,
  'coach-just': 4,
  'block':      5,
}

export async function generatePoliciesFromGovernance(): Promise<{ error?: string; count?: number }> {
  const user = await requireRole('analyst')
  const supabase = await createClient()

  // Guard: don't overwrite existing policies
  const { count: existing } = await supabase
    .from('org_genai_policies')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', user.orgId)
  if ((existing ?? 0) > 0) {
    return { error: 'Policies already exist. Clear existing policies before generating.' }
  }

  // Fetch app classifications grouped by type
  const { data: classifications } = await supabase
    .from('genai_customer_classifications')
    .select('app_id, customer_classification')
    .eq('org_id', user.orgId)

  const byClass = (cls: string) =>
    (classifications ?? [])
      .filter(c => c.customer_classification === cls)
      .map(c => c.app_id as string)

  const enterpriseApproved     = byClass('enterprise-approved')
  const approvedWithConditions = byClass('approved-with-conditions')
  const restricted             = byClass('permitted-with-restriction')
  const personal               = byClass('personal')
  const prohibited             = byClass('prohibited')
  const nonApproved            = [...restricted, ...prohibited]

  // Fetch governance categories to get category IDs
  const { data: categories } = await supabase
    .from('org_genai_governance_categories')
    .select('id, system_tag')
    .eq('org_id', user.orgId)
    .eq('active', true)

  const catId = (tag: string): string | null =>
    categories?.find(c => c.system_tag === tag)?.id ?? null

  // Fetch customer sensitivity labels and control matrix overrides in parallel
  const [{ data: customerLabels }, { data: matrixOverrides }] = await Promise.all([
    supabase
      .from('org_customer_sensitivity_labels')
      .select('id, display_name, system_level')
      .eq('org_id', user.orgId)
      .eq('active', true),
    supabase
      .from('org_control_matrix_overrides')
      .select('data_type, category_id, action_code')
      .eq('org_id', user.orgId),
  ])

  // Most restrictive action for a customer label across all governance categories
  function getLabelUploadAction(labelId: string, fallback: ActionCode): ActionCode {
    const overrides = (matrixOverrides ?? []).filter(o => o.data_type === `ul|dc|clabel:${labelId}`)
    if (overrides.length === 0) return fallback
    return overrides.reduce<ActionCode>((best, o) => {
      const code = o.action_code as ActionCode
      return (ACTION_RANK[code] ?? 0) > ACTION_RANK[best] ? code : best
    }, 'not-set')
  }

  const now = new Date().toISOString()
  const draftDefaults = {
    approval_status:            'draft',
    is_active:                  false,
    generated_from:             'governance-matrix',
    vendor_translation_status:  'pending',
    required_dependencies:      [],
    test_status:                'untested',
    updated_at:                 now,
  }

  // ── Base policies (content detection + governance) ────────────────────────
  const policies: object[] = [
    {
      org_id: user.orgId,
      priority: 1,
      name: 'GenAI — AI Acceptable Use Coaching',
      description: 'Educate users before or during GenAI usage with Coach 1 — AI Acceptable Use Policy.',
      policy_type: 'usage',
      category_id: catId('enterprise-approved'),
      scope_all_apps: true,
      scope_app_ids: [],
      rules: [],
      policy_family: 'GenAI Governance',
      data_classification_label: 'all',
      primary_action: 'coach',
      ...draftDefaults,
    },
    {
      org_id: user.orgId,
      priority: 2,
      name: 'GenAI — Prohibited Apps — Block Access',
      description: 'Block all access to prohibited GenAI apps. Display Coach 2 — Prohibited GenAI App on every attempt.',
      policy_type: 'prohibited',
      category_id: catId('prohibited'),
      scope_all_apps: prohibited.length === 0,
      scope_app_ids: prohibited,
      rules: [],
      policy_family: 'GenAI Access Control',
      data_classification_label: 'all',
      primary_action: 'block',
      ...draftDefaults,
    },
    // ── Content detection policies (policies 3–5) ─────────────────────────
    {
      org_id: user.orgId,
      priority: 3,
      name: 'GenAI — Secrets and Keys — Block Upload or Prompt',
      description: 'Prevent credentials, secrets, tokens, and private keys from being submitted to any GenAI tool.',
      policy_type: 'data-handling',
      category_id: null,
      scope_all_apps: true,
      scope_app_ids: [],
      rules: [],
      policy_family: 'GenAI Content Detection',
      data_classification_label: 'secret',
      primary_action: 'block',
      ...draftDefaults,
    },
    {
      org_id: user.orgId,
      priority: 4,
      name: 'GenAI — Secret Data — Block Across All AI Apps',
      description: 'Prevent the highest sensitivity business data (Secret classification) from entering any GenAI app.',
      policy_type: 'data-handling',
      category_id: null,
      scope_all_apps: true,
      scope_app_ids: [],
      rules: [],
      policy_family: 'GenAI Content Detection',
      data_classification_label: 'secret',
      primary_action: 'block',
      ...draftDefaults,
    },
    {
      org_id: user.orgId,
      priority: 5,
      name: 'GenAI — Highly Confidential Data — Block to Non-Approved AI',
      description: 'Block Highly Confidential data to restricted, unassessed, and prohibited GenAI apps. Display Coach 4 on violations.',
      policy_type: 'data-handling',
      category_id: catId('permitted-with-restriction'),
      scope_all_apps: nonApproved.length === 0,
      scope_app_ids: nonApproved,
      rules: [],
      policy_family: 'GenAI Content Detection',
      data_classification_label: 'highly-confidential',
      primary_action: 'block',
      ...draftDefaults,
    },
    {
      org_id: user.orgId,
      priority: 6,
      name: 'GenAI — Approved & Supported Apps — Allow Approved Usage',
      description: 'Permit approved enterprise GenAI usage after sensitive-data controls are applied. Placed below all block policies.',
      policy_type: 'approved-use',
      category_id: catId('enterprise-approved'),
      scope_all_apps: enterpriseApproved.length === 0,
      scope_app_ids: enterpriseApproved,
      rules: [],
      policy_family: 'GenAI Approved Usage',
      data_classification_label: 'all',
      primary_action: 'allow',
      ...draftDefaults,
    },
    {
      org_id: user.orgId,
      priority: 7,
      name: 'GenAI — Approved with Conditions — Sensitive Data Control',
      description: 'Allow limited GenAI usage for conditional apps. Coach on Confidential; block Highly Confidential and Secret.',
      policy_type: 'data-handling',
      category_id: catId('approved-with-conditions'),
      scope_all_apps: approvedWithConditions.length === 0,
      scope_app_ids: approvedWithConditions,
      rules: [],
      policy_family: 'GenAI Conditional Usage',
      data_classification_label: 'confidential',
      primary_action: 'coach',
      ...draftDefaults,
    },
    {
      org_id: user.orgId,
      priority: 8,
      name: 'GenAI — Restricted / Unassessed Apps — Control Usage',
      description: 'Limit unreviewed AI apps until assessed. Allow Public data; block Confidential and above.',
      policy_type: 'data-handling',
      category_id: catId('permitted-with-restriction'),
      scope_all_apps: restricted.length === 0,
      scope_app_ids: restricted,
      rules: [],
      policy_family: 'GenAI Restricted Usage',
      data_classification_label: 'confidential',
      primary_action: 'block',
      ...draftDefaults,
    },
    {
      org_id: user.orgId,
      priority: 9,
      name: 'GenAI — Personal Accounts — Restrict Sensitive Data',
      description: 'Prevent sensitive data from being sent to consumer/personal AI accounts.',
      policy_type: 'data-handling',
      category_id: catId('permitted-with-restriction'),
      scope_all_apps: personal.length === 0,
      scope_app_ids: personal,
      rules: [],
      policy_family: 'GenAI Instance / Account Control',
      data_classification_label: 'highly-confidential',
      primary_action: 'block',
      ...draftDefaults,
    },
    {
      org_id: user.orgId,
      priority: 10,
      name: 'GenAI — Monitoring and Visibility Baseline',
      description: 'Collect full GenAI visibility for reporting and discovery. Monitor all apps, all data, all activities.',
      policy_type: 'usage',
      category_id: null,
      scope_all_apps: true,
      scope_app_ids: [],
      rules: [],
      policy_family: 'GenAI Monitoring',
      data_classification_label: 'all',
      primary_action: 'monitor',
      ...draftDefaults,
    },
  ]

  // ── Label-detection policies (only when customer labels exist) ────────────
  // Groups: HC+Secret → one high-risk policy; Confidential → one policy.
  // post_prompt is always 'not-set' — label detection applies to uploads only.
  // Scope: scope_all_apps=true with the most restrictive action across all categories (V1).
  if ((customerLabels ?? []).length > 0) {
    const highRiskLabels = (customerLabels ?? []).filter(
      l => l.system_level === 'highly_confidential' || l.system_level === 'secret'
    )
    const confLabels = (customerLabels ?? []).filter(l => l.system_level === 'confidential')

    let nextPriority = policies.length + 1

    if (highRiskLabels.length > 0) {
      policies.push({
        org_id:      user.orgId,
        priority:    nextPriority++,
        name:        'GenAI — Sensitivity Label Detection — High Risk — Upload Control',
        description: `Block uploads of documents labelled: ${highRiskLabels.map(l => l.display_name).join(', ')}.`,
        policy_type: 'data-handling',
        category_id: null,
        scope_all_apps: true,
        scope_app_ids: [],
        rules: highRiskLabels.map(l => ({
          data_type:   `clabel:${l.id}`,
          post_prompt: 'not-set',
          upload:      getLabelUploadAction(l.id, 'block'),
          download:    'monitor',
          response:    'not-set',
        })),
        policy_family:             'GenAI Label Detection',
        data_classification_label: 'highly-confidential',
        primary_action:            'block',
        ...draftDefaults,
      })
    }

    if (confLabels.length > 0) {
      policies.push({
        org_id:      user.orgId,
        priority:    nextPriority++,
        name:        'GenAI — Sensitivity Label Detection — Confidential — Upload Control',
        description: `Coach on uploads of documents labelled: ${confLabels.map(l => l.display_name).join(', ')}.`,
        policy_type: 'data-handling',
        category_id: null,
        scope_all_apps: true,
        scope_app_ids: [],
        rules: confLabels.map(l => ({
          data_type:   `clabel:${l.id}`,
          post_prompt: 'not-set',
          upload:      getLabelUploadAction(l.id, 'coach'),
          download:    'monitor',
          response:    'not-set',
        })),
        policy_family:             'GenAI Label Detection',
        data_classification_label: 'confidential',
        primary_action:            'coach',
        ...draftDefaults,
      })
    }
  }

  const { error } = await supabase.from('org_genai_policies').insert(policies)
  if (error) return { error: error.message }

  revalidatePath('/genai-controls/policies')
  return { count: policies.length }
}

const ALLOWED_DIFF_KEYS: Set<keyof PolicyFields> = new Set([
  'name', 'description', 'policy_type', 'notes', 'is_active', 'priority',
  'scope_all_apps', 'scope_app_ids', 'rules', 'identity_context',
  'policy_family', 'data_classification_label', 'primary_action',
  'fallback_action', 'coaching_template_id', 'vendor_translation_status',
  'required_dependencies', 'test_status', 'review_date', 'next_review_date',
  'effective_date',
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
