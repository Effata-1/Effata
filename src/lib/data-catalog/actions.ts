'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { logAuditEvent } from '@/lib/audit'
import Anthropic from '@anthropic-ai/sdk'
import type { OrgClassificationLabel, OrgDataType, AISuggestion, SystemLevel, OrgDestinationTrustLabel, TrustTag } from './types'
import { SYSTEM_TRUST_DEFAULTS } from './types'

function revalidatePolicies() {
  revalidatePath('/policies/data-catalog')
  revalidatePath('/policies/classifications')
}

// ─── Classification label seeding ────────────────────────────────────────────

const SYSTEM_LABEL_DEFAULTS: Omit<OrgClassificationLabel, 'id' | 'org_id'>[] = [
  { system_level: 'secret',             name: 'Secret',             color: 'red',    priority: 1, description: 'Critical data that can cause severe damage if exposed. Block by default.',                            is_system: true, active: true },
  { system_level: 'highly_confidential',name: 'Highly Confidential',color: 'orange', priority: 2, description: 'Regulated, personal, financial, HR, legal, source code, and security-sensitive data.',               is_system: true, active: true },
  { system_level: 'confidential',       name: 'Confidential',       color: 'amber',  priority: 3, description: 'Sensitive business data — contracts, pricing, proposals, customer documents, and strategy.',          is_system: true, active: true },
  { system_level: 'internal',           name: 'Internal',           color: 'blue',   priority: 4, description: 'Normal internal business information. Not for public sharing, but not regulated.',                    is_system: true, active: true },
  { system_level: 'public',             name: 'Public',             color: 'green',  priority: 5, description: 'Formally approved for public release. Inspect for hidden sensitive content.',                         is_system: true, active: true },
]

export async function ensureClassificationLabels(): Promise<OrgClassificationLabel[]> {
  const user = await requireRole('analyst')
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('org_classification_labels')
    .select('*')
    .eq('org_id', user.orgId)
    .order('priority', { ascending: true })

  if (existing && existing.length > 0) return existing as OrgClassificationLabel[]

  // First visit — seed system defaults
  const rows = SYSTEM_LABEL_DEFAULTS.map(d => ({ ...d, org_id: user.orgId }))
  const { data: inserted, error } = await supabase
    .from('org_classification_labels')
    .insert(rows)
    .select()

  if (error) throw new Error(error.message)
  return (inserted ?? []) as OrgClassificationLabel[]
}

// ─── Label CRUD ───────────────────────────────────────────────────────────────

export async function upsertLabel(
  labelId: string | null,
  fields: { name: string; color: string; priority: number; description: string },
): Promise<{ error?: string }> {
  const user = await requireRole('admin')
  const supabase = await createClient()

  if (labelId) {
    const { error } = await supabase
      .from('org_classification_labels')
      .update({ name: fields.name, color: fields.color, priority: fields.priority, description: fields.description })
      .eq('id', labelId)
      .eq('org_id', user.orgId)
    if (error) return { error: error.message }
    await logAuditEvent({ action: 'classification_label.updated', entity_type: 'org_classification_labels', entity_id: labelId, details: fields })
  } else {
    const { error } = await supabase
      .from('org_classification_labels')
      .insert({ org_id: user.orgId, ...fields, is_system: false })
    if (error) return { error: error.message }
    await logAuditEvent({ action: 'classification_label.created', entity_type: 'org_classification_labels', entity_name: fields.name, details: fields })
  }
  revalidatePolicies()
  return {}
}

export async function deleteLabel(labelId: string): Promise<{ error?: string }> {
  const user = await requireRole('admin')
  const supabase = await createClient()

  // Block deletion if data types are mapped to this label
  const { count } = await supabase
    .from('org_data_type_classifications')
    .select('id', { count: 'exact', head: true })
    .eq('org_classification_label_id', labelId)
    .eq('org_id', user.orgId)

  if ((count ?? 0) > 0)
    return { error: `Cannot delete — ${count} data type${count === 1 ? '' : 's'} mapped to this label. Re-map them first.` }

  const { error } = await supabase
    .from('org_classification_labels')
    .delete()
    .eq('id', labelId)
    .eq('org_id', user.orgId)
    .eq('is_system', false)

  if (error) return { error: error.message }
  await logAuditEvent({ action: 'classification_label.deleted', entity_type: 'org_classification_labels', entity_id: labelId, details: {} })
  revalidatePolicies()
  return {}
}

export async function reorderLabels(orderedIds: string[]): Promise<{ error?: string }> {
  const user = await requireRole('admin')
  const supabase = await createClient()

  const updates = orderedIds.map((id, idx) =>
    supabase.from('org_classification_labels').update({ priority: idx + 1 }).eq('id', id).eq('org_id', user.orgId)
  )
  const results = await Promise.all(updates)
  const failed = results.find(r => r.error)
  if (failed?.error) return { error: failed.error.message }
  revalidatePolicies()
  return {}
}

// ─── Data type selection (catalog → org) ─────────────────────────────────────

export async function toggleInScope(
  catalogDataTypeId: string,
  currentlyInScope: boolean,
  systemLevel: SystemLevel,
): Promise<{ error?: string }> {
  const user = await requireRole('analyst')
  const supabase = await createClient()

  if (currentlyInScope) {
    // Remove from org — delete org_data_type + its classification mapping (cascade)
    const { error } = await supabase
      .from('org_data_types')
      .delete()
      .eq('org_id', user.orgId)
      .eq('catalog_data_type_id', catalogDataTypeId)
    if (error) return { error: error.message }
    revalidatePolicies()
  } else {
    // Fetch catalog type name
    const { data: cat } = await supabase
      .from('catalog_data_types')
      .select('name')
      .eq('id', catalogDataTypeId)
      .single()

    // Insert org_data_type
    const { data: orgType, error: insertErr } = await supabase
      .from('org_data_types')
      .insert({ org_id: user.orgId, catalog_data_type_id: catalogDataTypeId, name: cat?.name ?? '' })
      .select('id')
      .single()
    if (insertErr) return { error: insertErr.message }

    // Auto-map to matching system-level label (if org has one)
    const { data: label } = await supabase
      .from('org_classification_labels')
      .select('id')
      .eq('org_id', user.orgId)
      .eq('system_level', systemLevel)
      .single()

    if (label && orgType) {
      await supabase.from('org_data_type_classifications').insert({
        org_id: user.orgId,
        org_data_type_id: orgType.id,
        org_classification_label_id: label.id,
        mapped_by: 'system',
        confidence: 1.0,
      })
    }
    revalidatePolicies()
  }
  return {}
}

export async function batchToggleInScope(
  items: Array<{ catalogDataTypeId: string; systemLevel: SystemLevel; name: string }>,
  addToScope: boolean,
): Promise<{ error?: string }> {
  const user = await requireRole('analyst')
  const supabase = await createClient()

  if (!addToScope) {
    const { error } = await supabase
      .from('org_data_types')
      .delete()
      .eq('org_id', user.orgId)
      .in('catalog_data_type_id', items.map(i => i.catalogDataTypeId))
    if (error) return { error: error.message }
  } else {
    // Upsert org_data_types (skip existing)
    const { data: inserted, error: insertErr } = await supabase
      .from('org_data_types')
      .upsert(
        items.map(i => ({ org_id: user.orgId, catalog_data_type_id: i.catalogDataTypeId, name: i.name })),
        { onConflict: 'org_id,catalog_data_type_id' },
      )
      .select('id, catalog_data_type_id')
    if (insertErr) return { error: insertErr.message }

    // Fetch org labels for all system levels present in the batch
    const systemLevels = [...new Set(items.map(i => i.systemLevel))]
    const { data: labels } = await supabase
      .from('org_classification_labels')
      .select('id, system_level')
      .eq('org_id', user.orgId)
      .in('system_level', systemLevels)

    if (inserted?.length && labels?.length) {
      const labelByLevel = new Map(labels.map(l => [l.system_level, l.id]))
      const catLevelMap  = new Map(items.map(i => [i.catalogDataTypeId, i.systemLevel]))

      const classRows = inserted
        .filter(ins => ins.catalog_data_type_id && labelByLevel.has(catLevelMap.get(ins.catalog_data_type_id!)!))
        .map(ins => ({
          org_id:                      user.orgId,
          org_data_type_id:            ins.id,
          org_classification_label_id: labelByLevel.get(catLevelMap.get(ins.catalog_data_type_id!)!)!,
          mapped_by:                   'system' as const,
          confidence:                  1.0,
        }))

      if (classRows.length) {
        await supabase
          .from('org_data_type_classifications')
          .upsert(classRows, { onConflict: 'org_id,org_data_type_id' })
      }
    }
  }

  revalidatePolicies()
  return {}
}

export async function setClassification(
  orgDataTypeId: string,
  labelId: string,
): Promise<{ error?: string }> {
  const user = await requireRole('analyst')
  const supabase = await createClient()

  const { error } = await supabase
    .from('org_data_type_classifications')
    .upsert({
      org_id:                      user.orgId,
      org_data_type_id:            orgDataTypeId,
      org_classification_label_id: labelId,
      mapped_by:                   'user',
      confidence:                  null,
      mapped_at:                   new Date().toISOString(),
    }, { onConflict: 'org_id,org_data_type_id' })

  if (error) return { error: error.message }
  revalidatePolicies()
  return {}
}

export async function addCustomDataType(fields: {
  name:        string
  description: string
  examples:    string[]
  notes:       string
  labelId:     string
}): Promise<{ error?: string }> {
  const user = await requireRole('analyst')
  const supabase = await createClient()

  const { data: orgType, error: insertErr } = await supabase
    .from('org_data_types')
    .insert({
      org_id:      user.orgId,
      name:        fields.name,
      description: fields.description,
      examples:    fields.examples,
      notes:       fields.notes,
      is_custom:   true,
      is_in_scope: true,
    })
    .select('id')
    .single()

  if (insertErr) return { error: insertErr.message }

  if (fields.labelId && orgType) {
    await supabase.from('org_data_type_classifications').insert({
      org_id: user.orgId,
      org_data_type_id: orgType.id,
      org_classification_label_id: fields.labelId,
      mapped_by: 'user',
    })
  }

  await logAuditEvent({ action: 'data_type.custom_created', entity_type: 'org_data_types', entity_name: fields.name, details: {} })
  revalidatePolicies()
  return {}
}

// ─── AI mapping ───────────────────────────────────────────────────────────────

export async function suggestClassificationsAI(
  orgDataTypeIds: string[],
): Promise<{ suggestions?: AISuggestion[]; error?: string }> {
  const user = await requireRole('analyst')
  const supabase = await createClient()

  const [{ data: labels }, { data: dataTypes }] = await Promise.all([
    supabase
      .from('org_classification_labels')
      .select('id, name, description, priority')
      .eq('org_id', user.orgId)
      .eq('active', true)
      .order('priority'),
    supabase
      .from('org_data_types')
      .select('id, name, examples, notes')
      .eq('org_id', user.orgId)
      .in('id', orgDataTypeIds),
  ])

  if (!labels?.length) return { error: 'No classification labels found. Set up your labels first.' }
  if (!dataTypes?.length) return { error: 'No data types found.' }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY_GENAI_Intellegence_PIPELINE! })

  const systemPrompt = `You are a DLP data classification expert. Given an organisation's classification labels and a list of data types, suggest the most appropriate classification label for each data type. Respond ONLY with a valid JSON array. No markdown, no explanation outside the JSON.`

  const userPrompt = `Classification labels (priority 1 = highest risk):
${labels.map(l => `${l.priority}. "${l.name}": ${l.description ?? ''}`).join('\n')}

Data types to classify:
${dataTypes.map(d => `- id: "${d.id}", name: "${d.name}", examples: [${(d.examples ?? []).slice(0, 3).join(', ')}]${d.notes ? `, notes: "${d.notes}"` : ''}`).join('\n')}

Return JSON array:
[{ "data_type_id": "uuid", "label_name": "exact label name from list above", "confidence": 0.0-1.0, "reasoning": "one sentence" }]`

  const response = await client.messages.create({
    model:      'claude-sonnet-4-6',
    max_tokens: 4096,
    system:     systemPrompt,
    messages:   [{ role: 'user', content: userPrompt }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '[]'
  let raw: { data_type_id: string; label_name: string; confidence: number; reasoning: string }[]
  try {
    raw = JSON.parse(text)
  } catch {
    return { error: 'AI returned unexpected format. Please try again.' }
  }

  const labelMap = new Map(labels.map(l => [l.name.toLowerCase(), l.id]))

  const suggestions: AISuggestion[] = raw.map(r => ({
    org_data_type_id: r.data_type_id,
    label_name:       r.label_name,
    confidence:       Math.min(1, Math.max(0, r.confidence ?? 0.8)),
    reasoning:        r.reasoning ?? '',
    label_id:         labelMap.get(r.label_name.toLowerCase()),
  })).filter(s => s.label_id)

  return { suggestions }
}

export async function acceptAISuggestions(
  suggestions: AISuggestion[],
): Promise<{ error?: string }> {
  const user = await requireRole('analyst')
  const supabase = await createClient()

  const rows = suggestions
    .filter(s => s.label_id)
    .map(s => ({
      org_id:                      user.orgId,
      org_data_type_id:            s.org_data_type_id,
      org_classification_label_id: s.label_id!,
      confidence:                  s.confidence,
      mapped_by:                   'ai' as const,
      mapped_at:                   new Date().toISOString(),
    }))

  const { error } = await supabase
    .from('org_data_type_classifications')
    .upsert(rows, { onConflict: 'org_id,org_data_type_id' })

  if (error) return { error: error.message }
  await logAuditEvent({ action: 'classification.ai_mapping_accepted', entity_type: 'org_data_type_classifications', details: { count: rows.length } })
  revalidatePolicies()
  return {}
}

// ─── Data fetching helpers (called from server components) ────────────────────

export async function getCatalogPageData() {
  const user = await requireRole('analyst')
  const supabase = await createClient()

  const [{ data: catalog }, { data: orgTypes }, { data: labels }, { data: mappings }] = await Promise.all([
    supabase.from('catalog_data_types').select('*').eq('active', true).order('priority').order('subcategory').order('name'),
    supabase.from('org_data_types').select('*').eq('org_id', user.orgId),
    supabase.from('org_classification_labels').select('*').eq('org_id', user.orgId).eq('active', true).order('priority'),
    supabase.from('org_data_type_classifications').select('*').eq('org_id', user.orgId),
  ])

  return { catalog: catalog ?? [], orgTypes: orgTypes ?? [], labels: labels ?? [], mappings: mappings ?? [], orgId: user.orgId }
}

export async function getClassificationsPageData() {
  const user = await requireRole('analyst')
  const supabase = await createClient()

  const [labels, trustLabels] = await Promise.all([
    ensureClassificationLabels(),
    ensureDestinationTrustLabels(),
  ])

  const [{ data: orgTypes }, { data: mappings }, { data: destProfiles }, { data: catalogSubcats }, { data: catalogDataSubcats }] = await Promise.all([
    supabase.from('org_data_types').select('*').eq('org_id', user.orgId).eq('is_in_scope', true),
    supabase.from('org_data_type_classifications').select('*').eq('org_id', user.orgId),
    supabase.from('org_destination_profiles').select('trust_tag, subcategory').eq('org_id', user.orgId).eq('is_in_scope', true),
    supabase.from('catalog_destinations').select('trust_tag, subcategory').eq('active', true),
    supabase.from('catalog_data_types').select('id, system_level, subcategory').eq('active', true).not('subcategory', 'is', null),
  ])

  // destCountByTag — in-scope org_destination_profiles per trust_tag
  const destCountByTag: Record<string, number> = {}
  for (const p of (destProfiles ?? [])) {
    if (p.trust_tag) destCountByTag[p.trust_tag] = (destCountByTag[p.trust_tag] ?? 0) + 1
  }

  // subcategoriesByTag — org profiles are authoritative for subcategories they own;
  // catalog provides defaults for subcategories the org has no profiles for yet.
  // This means custom destinations and moveSubcategoryToTrust changes are reflected.
  const subcatByTagSet: Record<string, Set<string>> = {}
  const subcatsWithOrgProfiles = new Set<string>()
  for (const p of (destProfiles ?? [])) {
    if (p.subcategory) subcatsWithOrgProfiles.add(p.subcategory)
  }
  // Catalog: only for subcategories the org hasn't touched yet
  for (const c of (catalogSubcats ?? [])) {
    if (!c.subcategory || !c.trust_tag || subcatsWithOrgProfiles.has(c.subcategory)) continue
    if (!subcatByTagSet[c.trust_tag]) subcatByTagSet[c.trust_tag] = new Set()
    subcatByTagSet[c.trust_tag].add(c.subcategory)
  }
  // Org profiles: covers custom + any subcategory the org has moved or classified
  for (const p of (destProfiles ?? [])) {
    if (!p.subcategory || !p.trust_tag) continue
    if (!subcatByTagSet[p.trust_tag]) subcatByTagSet[p.trust_tag] = new Set()
    subcatByTagSet[p.trust_tag].add(p.subcategory)
  }
  const subcategoriesByTag: Record<string, string[]> = {}
  for (const [tag, subs] of Object.entries(subcatByTagSet)) {
    subcategoriesByTag[tag] = [...subs].sort()
  }

  // dataTypeSubcatsByLevel — built from actual org classification state so that
  // moveDataTypeSubcategoryToLabel reassignments are immediately reflected.
  // Falls back to catalog system_level for subcategories the org hasn't classified yet.
  const catalogIdToSubcat: Record<string, string> = {}
  for (const c of (catalogDataSubcats ?? [])) {
    if (c.id && c.subcategory) catalogIdToSubcat[c.id] = c.subcategory
  }
  const orgTypeIdToSubcat: Record<string, string> = {}
  for (const t of (orgTypes ?? [])) {
    if (t.catalog_data_type_id) {
      const sub = catalogIdToSubcat[t.catalog_data_type_id]
      if (sub) orgTypeIdToSubcat[t.id] = sub
    }
  }
  const labelIdToLevel: Record<string, string> = {}
  for (const l of labels) {
    if (l.system_level) labelIdToLevel[l.id] = l.system_level
  }
  const subcatByLevelSet: Record<string, Set<string>> = {}
  const orgClassifiedSubcats = new Set<string>()
  for (const m of (mappings ?? [])) {
    const subcat = orgTypeIdToSubcat[m.org_data_type_id]
    const level  = labelIdToLevel[m.org_classification_label_id]
    if (!subcat || !level) continue
    orgClassifiedSubcats.add(subcat)
    if (!subcatByLevelSet[level]) subcatByLevelSet[level] = new Set()
    subcatByLevelSet[level].add(subcat)
  }
  // Catalog fallback for subcategories not yet org-classified
  for (const c of (catalogDataSubcats ?? [])) {
    if (!c.subcategory || !c.system_level || orgClassifiedSubcats.has(c.subcategory)) continue
    if (!subcatByLevelSet[c.system_level]) subcatByLevelSet[c.system_level] = new Set()
    subcatByLevelSet[c.system_level].add(c.subcategory)
  }
  const dataTypeSubcatsByLevel: Record<string, string[]> = {}
  for (const [level, subs] of Object.entries(subcatByLevelSet)) {
    dataTypeSubcatsByLevel[level] = [...subs].sort()
  }

  return {
    labels,
    trustLabels,
    destCountByTag,
    subcategoriesByTag,
    dataTypeSubcatsByLevel,
    orgTypes:  orgTypes  ?? [],
    mappings:  mappings  ?? [],
    orgId:     user.orgId,
    userRole:  user.role,
  }
}

// ─── Destination trust label management ──────────────────────────────────────

export async function ensureDestinationTrustLabels(): Promise<OrgDestinationTrustLabel[]> {
  const user = await requireRole('analyst')
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('org_destination_trust_labels')
    .select('*')
    .eq('org_id', user.orgId)
    .order('priority')

  const existingTags = new Set((existing ?? []).map(r => r.system_tag).filter(Boolean))
  const missing = SYSTEM_TRUST_DEFAULTS.filter(d => d.system_tag && !existingTags.has(d.system_tag))

  if (missing.length === 0) return (existing ?? []) as OrgDestinationTrustLabel[]

  await supabase
    .from('org_destination_trust_labels')
    .insert(missing.map(d => ({ ...d, org_id: user.orgId })))

  const { data: refreshed } = await supabase
    .from('org_destination_trust_labels')
    .select('*')
    .eq('org_id', user.orgId)
    .order('priority')

  return (refreshed ?? []) as OrgDestinationTrustLabel[]
}

export async function upsertDestinationTrustLabel(
  labelId: string | null,
  fields: { name: string; color: string; priority: number; description: string },
): Promise<{ error?: string }> {
  const user = await requireRole('admin')
  const supabase = await createClient()

  if (labelId) {
    const { error } = await supabase
      .from('org_destination_trust_labels')
      .update({ name: fields.name, color: fields.color, priority: fields.priority, description: fields.description })
      .eq('id', labelId)
      .eq('org_id', user.orgId)
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase
      .from('org_destination_trust_labels')
      .insert({ org_id: user.orgId, ...fields, is_system: false })
    if (error) return { error: error.message }
  }

  revalidatePolicies()
  return {}
}

export async function deleteDestinationTrustLabel(labelId: string): Promise<{ error?: string }> {
  const user = await requireRole('admin')
  const supabase = await createClient()

  const { error } = await supabase
    .from('org_destination_trust_labels')
    .delete()
    .eq('id', labelId)
    .eq('org_id', user.orgId)
    .eq('is_system', false)

  if (error) return { error: error.message }
  revalidatePolicies()
  return {}
}

export async function moveSubcategoryToTrust(
  subcategory: string,
  newTrustTag: TrustTag,
): Promise<{ error?: string }> {
  const user = await requireRole('analyst')
  const supabase = await createClient()

  const { error } = await supabase
    .from('org_destination_profiles')
    .update({ trust_tag: newTrustTag })
    .eq('org_id', user.orgId)
    .eq('subcategory', subcategory)

  if (error) return { error: error.message }
  revalidatePolicies()
  revalidatePath('/policies/destinations')
  return {}
}

export async function moveDataTypeSubcategoryToLabel(
  subcategory: string,
  newLabelId: string,
): Promise<{ error?: string }> {
  const user = await requireRole('analyst')
  const supabase = await createClient()

  // Resolve which org_data_types belong to this subcategory (via catalog join)
  const [{ data: catalogTypes }, { data: orgTypes }] = await Promise.all([
    supabase.from('catalog_data_types').select('id').eq('subcategory', subcategory).eq('active', true),
    supabase.from('org_data_types').select('id, catalog_data_type_id').eq('org_id', user.orgId),
  ])

  const catalogIds = new Set((catalogTypes ?? []).map(c => c.id))
  const affectedOrgTypeIds = (orgTypes ?? [])
    .filter(t => t.catalog_data_type_id && catalogIds.has(t.catalog_data_type_id))
    .map(t => t.id)

  if (affectedOrgTypeIds.length === 0) return {}

  const rows = affectedOrgTypeIds.map(id => ({
    org_id:                      user.orgId,
    org_data_type_id:            id,
    org_classification_label_id: newLabelId,
    mapped_by:                   'user' as const,
    confidence:                  null,
  }))

  const { error } = await supabase
    .from('org_data_type_classifications')
    .upsert(rows, { onConflict: 'org_id,org_data_type_id' })

  if (error) return { error: error.message }
  revalidatePolicies()
  revalidatePath('/policies/data-catalog')
  return {}
}
