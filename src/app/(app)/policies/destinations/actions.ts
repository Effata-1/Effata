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

export type RiskLevel = 'critical' | 'high' | 'medium' | 'low'

export interface CatalogDestination {
  id:          string
  slug:        string
  name:        string
  trust_tag:   TrustTag
  risk_level:  RiskLevel
  subcategory: string
  description: string | null
  examples:    string[]
  notes:       string | null
  priority:    number
  active:      boolean
}

export interface OrgDestinationProfile {
  id:                     string
  org_id:                 string
  catalog_destination_id: string | null
  name:                   string
  subcategory:            string | null
  trust_tag:              TrustTag
  applications:           string[]
  notes:                  string | null
  definition:             string | null
  is_in_scope:            boolean
  is_custom:              boolean
  created_at:             string
  updated_at:             string
}

// Merged view used by the UI — one entry per catalog profile
export interface EnrichedDestination {
  // catalog fields
  catalog_id:  string
  slug:        string
  name:        string
  trust_tag:   TrustTag
  risk_level:  RiskLevel
  subcategory: string
  description: string | null
  examples:    string[]
  priority:    number
  // org profile (present if user has toggled this entry)
  org_profile_id: string | null
  is_in_scope:    boolean
  applications:   string[]
  notes:          string | null
  definition:     string | null
  is_custom:      false
}

// Custom destination — not linked to catalog
export interface CustomDestination {
  org_profile_id: string
  name:           string
  trust_tag:      TrustTag
  subcategory:    string
  applications:   string[]
  notes:          string | null
  definition:     string | null
  is_in_scope:    boolean
  is_custom:      true
  created_at:     string
}

function revalidate() {
  revalidatePath('/policies/destinations')
}

// ─── Data fetching ────────────────────────────────────────────────────────────

export async function getDestinationsPageData(): Promise<{
  enriched: EnrichedDestination[]
  custom:   CustomDestination[]
  error?:   string
}> {
  try {
    const user = await requireRole('analyst')
    const supabase = await createClient()

    const [{ data: catalog }, { data: profiles }] = await Promise.all([
      supabase
        .from('catalog_destinations')
        .select('*')
        .eq('active', true)
        .order('trust_tag')
        .order('priority')
        .order('name'),
      supabase
        .from('org_destination_profiles')
        .select('*')
        .eq('org_id', user.orgId),
    ])

    const profileByCatalogId = new Map(
      (profiles ?? [])
        .filter(p => p.catalog_destination_id)
        .map(p => [p.catalog_destination_id as string, p as OrgDestinationProfile]),
    )

    const enriched: EnrichedDestination[] = (catalog ?? []).map(c => {
      const p = profileByCatalogId.get(c.id)
      return {
        catalog_id:     c.id,
        slug:           c.slug,
        name:           p?.name ?? c.name,
        trust_tag:      (p?.trust_tag ?? c.trust_tag) as TrustTag,
        risk_level:     (c.risk_level ?? 'medium') as RiskLevel,
        subcategory:    p?.subcategory ?? c.subcategory,
        description:    c.description,
        examples:       c.examples ?? [],
        priority:       c.priority,
        org_profile_id: p?.id ?? null,
        is_in_scope:    p?.is_in_scope ?? false,
        applications:   p?.applications ?? [],
        notes:          p?.notes ?? null,
        definition:     p?.definition ?? null,
        is_custom:      false,
      }
    })

    const custom: CustomDestination[] = (profiles ?? [])
      .filter(p => p.is_custom)
      .map(p => ({
        org_profile_id: p.id,
        name:           p.name,
        trust_tag:      p.trust_tag as TrustTag,
        subcategory:    p.subcategory ?? 'custom',
        applications:   p.applications ?? [],
        notes:          p.notes,
        definition:     p.definition ?? null,
        is_in_scope:    p.is_in_scope,
        is_custom:      true,
        created_at:     p.created_at,
      }))

    return { enriched, custom }
  } catch {
    return { enriched: [], custom: [] }
  }
}

// ─── Toggle a catalog entry in/out of scope ───────────────────────────────────

export async function toggleDestinationInScope(
  catalogId: string,
  catalogName: string,
  catalogTrustTag: TrustTag,
  catalogSubcategory: string,
  currentlyInScope: boolean,
): Promise<{ error?: string }> {
  const user = await requireRole('analyst')
  const supabase = await createClient()

  if (currentlyInScope) {
    const { error } = await supabase
      .from('org_destination_profiles')
      .delete()
      .eq('org_id', user.orgId)
      .eq('catalog_destination_id', catalogId)
      .eq('is_custom', false)
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase
      .from('org_destination_profiles')
      .insert({
        org_id:                 user.orgId,
        catalog_destination_id: catalogId,
        name:                   catalogName,
        subcategory:            catalogSubcategory,
        trust_tag:              catalogTrustTag,
        is_in_scope:            true,
        is_custom:              false,
      })
    if (error) return { error: error.message }
  }

  revalidate()
  return {}
}

// ─── Update an org profile (rename, subcategory, apps, notes) ────────────────

export async function updateDestinationProfile(
  orgProfileId: string,
  fields: Partial<Pick<OrgDestinationProfile, 'name' | 'subcategory' | 'trust_tag' | 'applications' | 'notes' | 'definition'>>,
): Promise<{ error?: string }> {
  const user = await requireRole('analyst')
  const supabase = await createClient()

  const { error } = await supabase
    .from('org_destination_profiles')
    .update(fields)
    .eq('id', orgProfileId)
    .eq('org_id', user.orgId)

  if (error) return { error: error.message }
  revalidate()
  return {}
}

// ─── Add a custom destination ─────────────────────────────────────────────────

export async function addCustomDestination(fields: {
  name:        string
  subcategory: string
  trust_tag:   TrustTag
  applications: string[]
  notes:       string
  definition:  string
}): Promise<{ error?: string }> {
  const user = await requireRole('analyst')
  const supabase = await createClient()

  const { error } = await supabase
    .from('org_destination_profiles')
    .insert({
      org_id:                 user.orgId,
      catalog_destination_id: null,
      name:                   fields.name.trim(),
      subcategory:            fields.subcategory.trim() || 'custom',
      trust_tag:              fields.trust_tag,
      applications:           fields.applications,
      notes:                  fields.notes.trim() || null,
      definition:             fields.definition.trim() || null,
      is_in_scope:            true,
      is_custom:              true,
    })

  if (error) return { error: error.message }
  revalidate()
  return {}
}

// ─── Delete a custom destination ─────────────────────────────────────────────

export async function deleteCustomDestination(
  orgProfileId: string,
): Promise<{ error?: string }> {
  const user = await requireRole('analyst')
  const supabase = await createClient()

  const { error } = await supabase
    .from('org_destination_profiles')
    .delete()
    .eq('id', orgProfileId)
    .eq('org_id', user.orgId)
    .eq('is_custom', true)

  if (error) return { error: error.message }
  revalidate()
  return {}
}

// ─── App catalog search (unchanged from migration 024) ───────────────────────

export async function searchApps(query: string): Promise<string[]> {
  if (!query || query.length < 2) return []
  try {
    await requireRole('analyst')
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
