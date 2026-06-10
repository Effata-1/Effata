'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { logAuditEvent } from '@/lib/audit'

export type IdentityFieldName =
  | 'business_function'
  | 'privilege_level'
  | 'employment_type'
  | 'user_lifecycle_status'

export type IdentitySourceType =
  | 'ad_group'
  | 'ou'
  | 'hr_attribute'
  | 'okta_group'
  | 'google_group'
  | 'custom'

export type RiskLevel = 'critical' | 'high' | 'medium' | 'low'

export interface CatalogIdentityValue {
  id:          string
  field_name:  IdentityFieldName
  value_slug:  string
  value_name:  string
  description: string | null
  risk_level:  RiskLevel
  risk_note:   string | null
  priority:    number
}

export interface OrgIdentityMapping {
  id:               string
  org_id:           string
  catalog_value_id: string
  source_name:      string
  source_type:      IdentitySourceType
  notes:            string | null
  created_at:       string
}

export interface EnrichedIdentityValue extends CatalogIdentityValue {
  mappings:    OrgIdentityMapping[]
  is_in_scope: boolean
}

const FIELD_ORDER: IdentityFieldName[] = [
  'business_function',
  'privilege_level',
  'employment_type',
  'user_lifecycle_status',
]

function revalidate() {
  revalidatePath('/foundation/identity')
}

// ─── Data fetching ────────────────────────────────────────────────────────────

export async function getIdentityPageData(): Promise<{
  fields: Record<IdentityFieldName, EnrichedIdentityValue[]>
  fieldOrder: IdentityFieldName[]
  error?: string
}> {
  const empty = Object.fromEntries(
    FIELD_ORDER.map(f => [f, []]),
  ) as unknown as Record<IdentityFieldName, EnrichedIdentityValue[]>

  try {
    const user = await requireRole('analyst')
    const supabase = await createClient()

    const [{ data: catalog }, { data: mappings }, { data: scopeRows }] = await Promise.all([
      supabase
        .from('catalog_identity_values')
        .select('*')
        .eq('active', true)
        .order('field_name')
        .order('priority'),
      supabase
        .from('org_identity_mappings')
        .select('*')
        .eq('org_id', user.orgId)
        .order('created_at'),
      supabase
        .from('org_identity_scope')
        .select('catalog_value_id')
        .eq('org_id', user.orgId),
    ])

    const inScopeIds = new Set((scopeRows ?? []).map(r => r.catalog_value_id as string))

    const mappingsByValueId = new Map<string, OrgIdentityMapping[]>()
    for (const m of (mappings ?? [])) {
      const list = mappingsByValueId.get(m.catalog_value_id) ?? []
      list.push(m as OrgIdentityMapping)
      mappingsByValueId.set(m.catalog_value_id, list)
    }

    const fields = Object.fromEntries(
      FIELD_ORDER.map(f => [f, []]),
    ) as unknown as Record<IdentityFieldName, EnrichedIdentityValue[]>

    for (const c of (catalog ?? [])) {
      const fieldName = c.field_name as IdentityFieldName
      if (!fields[fieldName]) continue
      fields[fieldName].push({
        id:          c.id,
        field_name:  fieldName,
        value_slug:  c.value_slug,
        value_name:  c.value_name,
        description: c.description ?? null,
        risk_level:  (c.risk_level ?? 'medium') as RiskLevel,
        risk_note:   c.risk_note ?? null,
        priority:    c.priority,
        mappings:    mappingsByValueId.get(c.id) ?? [],
        is_in_scope: inScopeIds.has(c.id),
      })
    }

    return { fields, fieldOrder: FIELD_ORDER }
  } catch {
    return { fields: empty, fieldOrder: FIELD_ORDER }
  }
}

// ─── Add a mapping ────────────────────────────────────────────────────────────

export async function addIdentityMapping(
  catalogValueId: string,
  sourceName:     string,
  sourceType:     IdentitySourceType,
  notes:          string,
): Promise<{ id?: string; error?: string }> {
  const user = await requireRole('analyst')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('org_identity_mappings')
    .insert({
      org_id:           user.orgId,
      catalog_value_id: catalogValueId,
      source_name:      sourceName.trim(),
      source_type:      sourceType,
      notes:            notes.trim() || null,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }
  await logAuditEvent({
    action:      'identity.mapping_added',
    entity_type: 'org_identity_mappings',
    entity_name: sourceName,
    details:     { catalog_value_id: catalogValueId, source_type: sourceType },
    org_id:  user.orgId,
    user_id: user.id,
  })
  revalidate()
  return { id: data.id }
}

// ─── Update a mapping ─────────────────────────────────────────────────────────

export async function updateIdentityMapping(
  mappingId:  string,
  fields: Partial<Pick<OrgIdentityMapping, 'source_name' | 'source_type' | 'notes'>>,
): Promise<{ error?: string }> {
  const user = await requireRole('analyst')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('org_identity_mappings')
    .update(fields)
    .eq('id', mappingId)
    .eq('org_id', user.orgId)
    .select('id')
    .maybeSingle()

  if (error) return { error: error.message }
  if (!data) return { error: 'Mapping not found.' }
  await logAuditEvent({
    action:      'identity.mapping_updated',
    entity_type: 'org_identity_mappings',
    entity_id:   mappingId,
    details:     fields as Record<string, unknown>,
    org_id:  user.orgId,
    user_id: user.id,
  })
  revalidate()
  return {}
}

// ─── Delete a mapping ─────────────────────────────────────────────────────────

export async function deleteIdentityMapping(
  mappingId: string,
): Promise<{ error?: string }> {
  const user = await requireRole('analyst')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('org_identity_mappings')
    .delete()
    .eq('id', mappingId)
    .eq('org_id', user.orgId)
    .select('id')
    .maybeSingle()

  if (error) return { error: error.message }
  if (!data) return { error: 'Mapping not found.' }
  await logAuditEvent({
    action:      'identity.mapping_deleted',
    entity_type: 'org_identity_mappings',
    entity_id:   mappingId,
    org_id:  user.orgId,
    user_id: user.id,
  })
  revalidate()
  return {}
}

// ─── Toggle identity value in scope ──────────────────────────────────────────

export async function toggleIdentityValueInScope(
  catalogValueId:   string,
  currentlyInScope: boolean,
): Promise<{ error?: string }> {
  const user     = await requireRole('analyst')
  const supabase = await createClient()

  if (currentlyInScope) {
    const { data, error } = await supabase
      .from('org_identity_scope')
      .delete()
      .eq('org_id', user.orgId)
      .eq('catalog_value_id', catalogValueId)
      .select('catalog_value_id')
      .maybeSingle()
    if (error) return { error: error.message }
    // Already removed — desired state already correct, no audit needed.
    if (!data) return {}
  } else {
    const { error } = await supabase
      .from('org_identity_scope')
      .insert({ org_id: user.orgId, catalog_value_id: catalogValueId })
    if (error) return { error: error.message }
  }

  await logAuditEvent({
    action:      'identity.scope_toggled',
    entity_type: 'org_identity_scope',
    entity_id:   catalogValueId,
    new_value:   currentlyInScope ? 'removed' : 'added',
    org_id:  user.orgId,
    user_id: user.id,
  })
  revalidate()
  return {}
}
