'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
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

  const now = new Date().toISOString()

  const policies = [
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
      approval_status: 'draft',
      is_active: false,
      policy_family: 'GenAI Governance',
      generated_from: 'governance-matrix',
      data_classification_label: 'all',
      primary_action: 'coach',
      vendor_translation_status: 'pending',
      required_dependencies: [],
      test_status: 'untested',
      updated_at: now,
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
      approval_status: 'draft',
      is_active: false,
      policy_family: 'GenAI Access Control',
      generated_from: 'governance-matrix',
      data_classification_label: 'all',
      primary_action: 'block',
      vendor_translation_status: 'pending',
      required_dependencies: [],
      test_status: 'untested',
      updated_at: now,
    },
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
      approval_status: 'draft',
      is_active: false,
      policy_family: 'GenAI Data Protection',
      generated_from: 'governance-matrix',
      data_classification_label: 'secret',
      primary_action: 'block',
      vendor_translation_status: 'pending',
      required_dependencies: [],
      test_status: 'untested',
      updated_at: now,
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
      approval_status: 'draft',
      is_active: false,
      policy_family: 'GenAI Data Classification Protection',
      generated_from: 'governance-matrix',
      data_classification_label: 'secret',
      primary_action: 'block',
      vendor_translation_status: 'pending',
      required_dependencies: [],
      test_status: 'untested',
      updated_at: now,
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
      approval_status: 'draft',
      is_active: false,
      policy_family: 'GenAI Data Classification Protection',
      generated_from: 'governance-matrix',
      data_classification_label: 'highly-confidential',
      primary_action: 'block',
      vendor_translation_status: 'pending',
      required_dependencies: [],
      test_status: 'untested',
      updated_at: now,
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
      approval_status: 'draft',
      is_active: false,
      policy_family: 'GenAI Approved Usage',
      generated_from: 'governance-matrix',
      data_classification_label: 'all',
      primary_action: 'allow',
      vendor_translation_status: 'pending',
      required_dependencies: [],
      test_status: 'untested',
      updated_at: now,
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
      approval_status: 'draft',
      is_active: false,
      policy_family: 'GenAI Conditional Usage',
      generated_from: 'governance-matrix',
      data_classification_label: 'confidential',
      primary_action: 'coach',
      vendor_translation_status: 'pending',
      required_dependencies: [],
      test_status: 'untested',
      updated_at: now,
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
      approval_status: 'draft',
      is_active: false,
      policy_family: 'GenAI Restricted Usage',
      generated_from: 'governance-matrix',
      data_classification_label: 'confidential',
      primary_action: 'block',
      vendor_translation_status: 'pending',
      required_dependencies: [],
      test_status: 'untested',
      updated_at: now,
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
      approval_status: 'draft',
      is_active: false,
      policy_family: 'GenAI Instance / Account Control',
      generated_from: 'governance-matrix',
      data_classification_label: 'highly-confidential',
      primary_action: 'block',
      vendor_translation_status: 'pending',
      required_dependencies: [],
      test_status: 'untested',
      updated_at: now,
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
      approval_status: 'draft',
      is_active: false,
      policy_family: 'GenAI Monitoring',
      generated_from: 'governance-matrix',
      data_classification_label: 'all',
      primary_action: 'monitor',
      vendor_translation_status: 'pending',
      required_dependencies: [],
      test_status: 'untested',
      updated_at: now,
    },
  ]

  const { error } = await supabase.from('org_genai_policies').insert(policies)
  if (error) return { error: error.message }

  revalidatePath('/genai-controls/policies')
  return { count: policies.length }
}
