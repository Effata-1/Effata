'use server'

import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { logAuditEvent } from '@/lib/audit'
import Anthropic from '@anthropic-ai/sdk'
import type { OrgClassificationLabel, OrgDataType, AISuggestion, SystemLevel } from './types'

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
  }
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

  const labels = await ensureClassificationLabels()

  const [{ data: orgTypes }, { data: mappings }] = await Promise.all([
    supabase.from('org_data_types').select('*').eq('org_id', user.orgId).eq('is_in_scope', true),
    supabase.from('org_data_type_classifications').select('*').eq('org_id', user.orgId),
  ])

  return { labels, orgTypes: orgTypes ?? [], mappings: mappings ?? [], orgId: user.orgId, userRole: user.role }
}
