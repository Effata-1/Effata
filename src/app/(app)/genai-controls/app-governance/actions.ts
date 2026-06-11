'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { logAuditEvent } from '@/lib/audit'

export interface GenAIGovernanceCategory {
  id: string
  org_id: string
  system_tag: string | null
  name: string
  description: string | null
  color: string
  priority: number
  is_system: boolean
  active: boolean
  created_at: string
}

const SYSTEM_DEFAULTS: Omit<GenAIGovernanceCategory, 'id' | 'org_id' | 'created_at'>[] = [
  {
    system_tag: 'enterprise-approved',
    name: 'Approved & Supported',
    description: 'Enterprise-approved AI tools with full admin controls, DLP support, and BAA/DPA in place.',
    color: 'emerald',
    priority: 1,
    is_system: true,
    active: true,
  },
  {
    system_tag: 'approved-with-conditions',
    name: 'Approved with Conditions',
    description: 'Permitted under specific data, user, or activity conditions — monitored and policy-enforced.',
    color: 'blue',
    priority: 2,
    is_system: true,
    active: true,
  },
  {
    system_tag: 'permitted-with-restriction',
    name: 'Restricted / Unassessed',
    description: 'Limited usage allowed with coaching and monitoring. Includes unassessed tools.',
    color: 'amber',
    priority: 3,
    is_system: true,
    active: true,
  },
  {
    system_tag: 'prohibited',
    name: 'Prohibited',
    description: 'Blocked for all users and data types. No exceptions without explicit approval.',
    color: 'red',
    priority: 4,
    is_system: true,
    active: true,
  },
]

function revalidateGenAI() {
  revalidatePath('/genai-controls/app-governance')
  revalidatePath('/genai-controls/policy-matrix')
}

export async function ensureGenAIGovernanceCategories(): Promise<GenAIGovernanceCategory[]> {
  const user = await requireRole('analyst')
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('org_genai_governance_categories')
    .select('*')
    .eq('org_id', user.orgId)
    .eq('active', true)
    .order('priority')

  const existingTags = new Set((existing ?? []).map((r: GenAIGovernanceCategory) => r.system_tag).filter(Boolean))
  const missing = SYSTEM_DEFAULTS.filter(d => d.system_tag && !existingTags.has(d.system_tag))

  if (missing.length === 0) return (existing ?? []) as GenAIGovernanceCategory[]

  await supabase
    .from('org_genai_governance_categories')
    .insert(missing.map(d => ({ ...d, org_id: user.orgId })))

  const { data: refreshed } = await supabase
    .from('org_genai_governance_categories')
    .select('*')
    .eq('org_id', user.orgId)
    .eq('active', true)
    .order('priority')

  return (refreshed ?? []) as GenAIGovernanceCategory[]
}

export async function upsertGenAICategory(
  categoryId: string | null,
  fields: { name: string; color: string; priority: number; description: string },
): Promise<{ error?: string }> {
  const user = await requireRole('admin')
  const supabase = await createClient()

  if (categoryId) {
    const { data, error } = await supabase
      .from('org_genai_governance_categories')
      .update({ name: fields.name, color: fields.color, priority: fields.priority, description: fields.description })
      .eq('id', categoryId)
      .eq('org_id', user.orgId)
      .select('id')
      .maybeSingle()
    if (error) return { error: error.message }
    if (!data) return { error: 'Category not found.' }
    await logAuditEvent({
      action:      'app_governance.category_updated',
      entity_type: 'org_genai_governance_categories',
      entity_id:   categoryId,
      entity_name: fields.name,
      details:     fields,
      org_id:  user.orgId,
      user_id: user.id,
    user_email:  user.email,
    })
  } else {
    let baseTag = fields.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
    if (!baseTag) baseTag = `custom_${Date.now()}`

    // Ensure uniqueness within the org by appending a counter if the tag already exists
    const { data: existing } = await supabase
      .from('org_genai_governance_categories')
      .select('system_tag')
      .eq('org_id', user.orgId)
      .like('system_tag', `${baseTag}%`)
    const existingTags = new Set((existing ?? []).map((r: { system_tag: string | null }) => r.system_tag))
    let system_tag = baseTag
    let suffix = 2
    while (existingTags.has(system_tag)) {
      system_tag = `${baseTag}_${suffix}`
      suffix++
    }

    const { error } = await supabase
      .from('org_genai_governance_categories')
      .insert({ org_id: user.orgId, ...fields, is_system: false, system_tag })
    if (error) return { error: error.message }
    await logAuditEvent({
      action:      'app_governance.category_created',
      entity_type: 'org_genai_governance_categories',
      entity_name: fields.name,
      details:     fields,
      org_id:  user.orgId,
      user_id: user.id,
    user_email:  user.email,
    })
  }

  revalidateGenAI()
  return {}
}

export async function deleteGenAICategory(categoryId: string): Promise<{ error?: string }> {
  const user = await requireRole('admin')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('org_genai_governance_categories')
    .delete()
    .eq('id', categoryId)
    .eq('org_id', user.orgId)
    .eq('is_system', false)
    .select('id')
    .maybeSingle()

  if (error) return { error: error.message }
  // Supabase returns no error when 0 rows match — guard explicitly so we don't log a phantom deletion.
  if (!data) return { error: 'Category not found or cannot be deleted.' }
  await logAuditEvent({
    action:      'app_governance.category_deleted',
    entity_type: 'org_genai_governance_categories',
    entity_id:   categoryId,
    org_id:  user.orgId,
    user_id: user.id,
    user_email:  user.email,
  })
  revalidateGenAI()
  return {}
}

export async function saveRefAppData(
  appSlug: string,
  data: { notes?: string; in_scope?: boolean; classification?: string | null },
): Promise<{ error?: string }> {
  const user = await requireRole('analyst')
  const supabase = await createClient()

  const { error } = await supabase
    .from('org_reference_app_notes')
    .upsert(
      {
        org_id:         user.orgId,
        app_slug:       appSlug,
        notes:          data.notes ?? null,
        in_scope:       data.in_scope ?? false,
        classification: data.classification ?? null,
        updated_at:     new Date().toISOString(),
      },
      { onConflict: 'org_id,app_slug' },
    )

  if (error) return { error: error.message }
  revalidatePath('/genai-controls/app-governance')
  return {}
}

export async function setAppGovernanceClassification(
  appId: string,
  classification: string,
): Promise<{ error?: string }> {
  const user = await requireRole('analyst')
  const supabase = await createClient()

  const { error } = await supabase
    .from('genai_customer_classifications')
    .upsert({
      org_id: user.orgId,
      app_id: appId,
      customer_classification: classification,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'org_id,app_id' })

  if (error) return { error: error.message }
  await logAuditEvent({
    action:      'app_governance.app_classified',
    entity_type: 'genai_customer_classifications',
    entity_id:   appId,
    new_value:   classification,
    org_id:  user.orgId,
    user_id: user.id,
    user_email:  user.email,
  })
  revalidatePath('/genai-controls/app-governance')
  return {}
}
