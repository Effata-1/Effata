'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'

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
  mappings: OrgIdentityMapping[]
}

export const FIELD_LABELS: Record<IdentityFieldName, string> = {
  business_function:      'Business Function',
  privilege_level:        'Privilege Level',
  employment_type:        'Employment Type',
  user_lifecycle_status:  'User Lifecycle Status',
}

export const FIELD_DESCRIPTIONS: Record<IdentityFieldName, string> = {
  business_function:     'Map your organisation\'s departments, OUs, and groups to standard DLP business function categories.',
  privilege_level:       'Identify which groups have admin or elevated access — these carry higher DLP impact.',
  employment_type:       'Distinguish employees, contractors, vendors, and service accounts for contextual risk.',
  user_lifecycle_status: 'Track leavers, inactive accounts, and role changes — the highest-risk identity events.',
}

export const SOURCE_TYPE_LABELS: Record<IdentitySourceType, string> = {
  ad_group:     'AD Group',
  ou:           'OU',
  hr_attribute: 'HR Attribute',
  okta_group:   'Okta Group',
  google_group: 'Google Group',
  custom:       'Custom',
}

const FIELD_ORDER: IdentityFieldName[] = [
  'business_function',
  'privilege_level',
  'employment_type',
  'user_lifecycle_status',
]

function revalidate() {
  revalidatePath('/policies/identity')
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

    const [{ data: catalog }, { data: mappings }] = await Promise.all([
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
    ])

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

  const { error } = await supabase
    .from('org_identity_mappings')
    .update(fields)
    .eq('id', mappingId)
    .eq('org_id', user.orgId)

  if (error) return { error: error.message }
  revalidate()
  return {}
}

// ─── Delete a mapping ─────────────────────────────────────────────────────────

export async function deleteIdentityMapping(
  mappingId: string,
): Promise<{ error?: string }> {
  const user = await requireRole('analyst')
  const supabase = await createClient()

  const { error } = await supabase
    .from('org_identity_mappings')
    .delete()
    .eq('id', mappingId)
    .eq('org_id', user.orgId)

  if (error) return { error: error.message }
  revalidate()
  return {}
}
