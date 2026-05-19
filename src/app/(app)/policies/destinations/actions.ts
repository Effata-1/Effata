'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'

export type TrustTag =
  | 'enterprise_approved'
  | 'approved_with_conditions'
  | 'permitted_with_restriction'
  | 'personal'
  | 'public'
  | 'unknown'
  | 'prohibited'

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'

export interface OrgDestination {
  id:               string
  org_id:           string
  name:             string
  destination_type: string
  trust_tag:        TrustTag
  risk_level:       RiskLevel | null
  risk_notes:       string | null
  notes:            string | null
  applications:     string[]
  created_at:       string
  updated_at:       string
}

function revalidate() {
  revalidatePath('/policies/destinations')
}

export async function getDestinations(): Promise<{ destinations: OrgDestination[]; error?: string }> {
  try {
    const user = await requireRole('analyst')
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('org_destinations')
      .select('*')
      .eq('org_id', user.orgId)
      .order('created_at', { ascending: true })
    if (error) return { destinations: [], error: error.message }
    return { destinations: (data ?? []) as OrgDestination[] }
  } catch {
    return { destinations: [] }
  }
}

export async function searchApps(query: string): Promise<string[]> {
  if (!query || query.length < 2) return []
  try {
    const user = await requireRole('analyst')
    const supabase = await createClient()
    const { data } = await supabase
      .from('catalog_apps')
      .select('name')
      .ilike('name', `%${query}%`)
      .order('name')
      .limit(20)
    return (data ?? []).map((d: { name: string }) => d.name)
  } catch {
    return []
  }
}

export async function addDestination(fields: {
  name:             string
  destination_type: string
  trust_tag:        TrustTag
  risk_level:       RiskLevel | null
  risk_notes:       string
  notes:            string
  applications:     string[]
}): Promise<{ destination?: OrgDestination; error?: string }> {
  const user = await requireRole('analyst')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('org_destinations')
    .insert({
      org_id:           user.orgId,
      name:             fields.name.trim(),
      destination_type: fields.destination_type,
      trust_tag:        fields.trust_tag,
      risk_level:       fields.risk_level,
      risk_notes:       fields.risk_notes.trim() || null,
      notes:            fields.notes.trim() || null,
      applications:     fields.applications,
    })
    .select()
    .single()

  if (error) return { error: error.message }
  revalidate()
  return { destination: data as OrgDestination }
}

export async function updateDestination(
  id: string,
  fields: Partial<Pick<OrgDestination, 'name' | 'destination_type' | 'trust_tag' | 'risk_level' | 'risk_notes' | 'notes' | 'applications'>>,
): Promise<{ error?: string }> {
  const user = await requireRole('analyst')
  const supabase = await createClient()

  const { error } = await supabase
    .from('org_destinations')
    .update(fields)
    .eq('id', id)
    .eq('org_id', user.orgId)

  if (error) return { error: error.message }
  revalidate()
  return {}
}

export async function deleteDestination(id: string): Promise<{ error?: string }> {
  const user = await requireRole('analyst')
  const supabase = await createClient()

  const { error } = await supabase
    .from('org_destinations')
    .delete()
    .eq('id', id)
    .eq('org_id', user.orgId)

  if (error) return { error: error.message }
  revalidate()
  return {}
}
