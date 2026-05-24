'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'

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
    name: 'Approved & Supported GenAI',
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
    name: 'Restricted / Unassessed GenAI',
    description: 'Limited usage allowed with coaching and monitoring. Includes unassessed tools.',
    color: 'amber',
    priority: 3,
    is_system: true,
    active: true,
  },
  {
    system_tag: 'prohibited',
    name: 'Prohibited GenAI',
    description: 'Blocked for all users and data types. No exceptions without explicit approval.',
    color: 'red',
    priority: 4,
    is_system: true,
    active: true,
  },
  {
    system_tag: 'personal',
    name: 'Personal GenAI Instance',
    description: 'Personal or unmanaged AI accounts — treated as untrusted destinations.',
    color: 'purple',
    priority: 5,
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
    const { error } = await supabase
      .from('org_genai_governance_categories')
      .update({ name: fields.name, color: fields.color, priority: fields.priority, description: fields.description })
      .eq('id', categoryId)
      .eq('org_id', user.orgId)
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase
      .from('org_genai_governance_categories')
      .insert({ org_id: user.orgId, ...fields, is_system: false })
    if (error) return { error: error.message }
  }

  revalidateGenAI()
  return {}
}

export async function deleteGenAICategory(categoryId: string): Promise<{ error?: string }> {
  const user = await requireRole('admin')
  const supabase = await createClient()

  const { error } = await supabase
    .from('org_genai_governance_categories')
    .delete()
    .eq('id', categoryId)
    .eq('org_id', user.orgId)
    .eq('is_system', false)

  if (error) return { error: error.message }
  revalidateGenAI()
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
  revalidatePath('/genai-controls/app-governance')
  return {}
}
