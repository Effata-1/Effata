'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'

function revalidateSetup() {
  revalidatePath('/genai-controls')
}

export async function markLabelsReviewed(): Promise<{ error?: string }> {
  const user = await requireRole('analyst')
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('onboarding_profiles')
    .select('genai_setup_flags')
    .eq('org_id', user.orgId)
    .maybeSingle()

  const flags = (existing?.genai_setup_flags as Record<string, boolean> | null) ?? {}

  const { error } = await supabase
    .from('onboarding_profiles')
    .update({ genai_setup_flags: { ...flags, labels_reviewed: true }, updated_at: new Date().toISOString() })
    .eq('org_id', user.orgId)

  if (error) return { error: error.message }
  revalidateSetup()
  return {}
}

export async function markMatrixReviewed(): Promise<{ error?: string }> {
  const user = await requireRole('analyst')
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('onboarding_profiles')
    .select('genai_setup_flags')
    .eq('org_id', user.orgId)
    .maybeSingle()

  const flags = (existing?.genai_setup_flags as Record<string, boolean> | null) ?? {}

  const { error } = await supabase
    .from('onboarding_profiles')
    .update({ genai_setup_flags: { ...flags, matrix_reviewed: true }, updated_at: new Date().toISOString() })
    .eq('org_id', user.orgId)

  if (error) return { error: error.message }
  revalidateSetup()
  return {}
}

export async function applyAppGovernanceDefaults(): Promise<{ error?: string; count: number }> {
  const user = await requireRole('analyst')
  const supabase = await createClient()

  // Read app profiles (enterprise mode) to determine classification
  const { data: profiles, error: profileErr } = await supabase
    .from('genai_app_profiles')
    .select('app_id, dlp, breach_info')
    .eq('mode', 'enterprise')

  if (profileErr) return { error: profileErr.message, count: 0 }
  if (!profiles || profiles.length === 0) return { error: 'No app profiles found. Run the GenAI app refresh first.', count: 0 }

  // Skip apps already classified
  const { data: existing } = await supabase
    .from('genai_customer_classifications')
    .select('app_id')
    .eq('org_id', user.orgId)
    .neq('customer_classification', 'unknown')

  const alreadyClassified = new Set((existing ?? []).map((r: { app_id: string }) => r.app_id))

  const rows: Array<{ org_id: string; app_id: string; customer_classification: string; updated_at: string }> = []
  const now = new Date().toISOString()

  for (const p of profiles) {
    if (alreadyClassified.has(p.app_id)) continue

    const dlp         = (p.dlp         as Record<string, string>) ?? {}
    const breachInfo  = (p.breach_info as Record<string, string>) ?? {}
    const recentBreach = breachInfo.recent_breach === 'yes'
    const postPrompt   = dlp.post_prompt ?? ''

    let classification: string | null = null

    if (postPrompt === 'enforcement' && !recentBreach) {
      classification = 'enterprise-approved'
    } else if (postPrompt === 'enforcement' && recentBreach) {
      classification = 'permitted-with-restriction'
    } else if (postPrompt === 'monitoring') {
      classification = 'approved-with-conditions'
    } else if (postPrompt === 'partial') {
      classification = 'permitted-with-restriction'
    }
    // no-published / not-supported → leave unclassified (don't force assign)

    if (classification) {
      rows.push({ org_id: user.orgId, app_id: p.app_id, customer_classification: classification, updated_at: now })
    }
  }

  if (rows.length === 0) return { count: 0 }

  const { error } = await supabase
    .from('genai_customer_classifications')
    .upsert(rows, { onConflict: 'org_id,app_id' })

  if (error) return { error: error.message, count: 0 }
  revalidateSetup()
  revalidatePath('/genai-controls/app-governance')
  return { count: rows.length }
}

export async function applyDataCatalogDefaults(): Promise<{ error?: string; count: number }> {
  const user = await requireRole('analyst')
  const supabase = await createClient()

  // Select all catalog types at secret, highly_confidential, and confidential levels
  // as the recommended in-scope defaults — covers PII, financial, health, credentials, source code
  const { data: catalogTypes, error: catalogErr } = await supabase
    .from('catalog_data_types')
    .select('id, name, system_level')
    .in('system_level', ['secret', 'highly_confidential', 'confidential'])
    .eq('active', true)

  if (catalogErr) return { error: catalogErr.message, count: 0 }
  if (!catalogTypes || catalogTypes.length === 0) return { count: 0 }

  // Skip types already added for this org
  const { data: existing } = await supabase
    .from('org_data_types')
    .select('catalog_data_type_id')
    .eq('org_id', user.orgId)
    .not('catalog_data_type_id', 'is', null)

  const alreadyAdded = new Set((existing ?? []).map((r: { catalog_data_type_id: string | null }) => r.catalog_data_type_id).filter(Boolean))

  const toAdd = catalogTypes.filter((t: { id: string }) => !alreadyAdded.has(t.id))
  if (toAdd.length === 0) return { count: 0 }

  const now = new Date().toISOString()
  const rows = toAdd.map((t: { id: string; name: string }) => ({
    org_id:               user.orgId,
    name:                 t.name,
    catalog_data_type_id: t.id,
    is_in_scope:          true,
    is_custom:            false,
    created_at:           now,
    updated_at:           now,
  }))

  const { error } = await supabase.from('org_data_types').insert(rows)
  if (error) return { error: error.message, count: 0 }

  revalidateSetup()
  revalidatePath('/policies/data-catalog')
  return { count: rows.length }
}
