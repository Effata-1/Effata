'use server'

import { createClient } from '@/lib/supabase/server'
import { logAuditEvent } from '@/lib/audit'
import { logAiSearch } from '@/lib/ai-log'
import { callAgent } from '@/lib/api-client'

// ── AI Log Types ──────────────────────────────────────────────────────────────

export interface AiSearchLog {
  id:         string
  source:     string
  prompt:     string
  result:     string | null
  created_at: string
}

export interface LearnedTemplate {
  id:          string
  ext:         string
  filename:    string
  description: string
  content:     string
  mime_type:   string | null
  created_at:  string
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GeneratedData {
  columns: string[]
  records: Record<string, string>[]
  description: string
}

export interface SavedDataset {
  id: string
  name: string
  description: string | null
  columns: string[]
  records: Record<string, string>[]
  row_count: number
  ai_generated: boolean
  ai_prompt: string | null
  created_at: string
}

// ── AI Generation ─────────────────────────────────────────────────────────────

export async function generateTestData(
  prompt: string,
  rowCount: number
): Promise<{ result?: GeneratedData; error?: string }> {
  if (!prompt.trim()) return { error: 'Prompt is required' }

  const safeRowCount = Math.min(Math.max(1, rowCount), 50)

  try {
    const result = await callAgent<GeneratedData>('test-data', { prompt, rowCount: safeRowCount })
    logAiSearch('test_data', prompt, result.description)
    return { result }
  } catch (e) {
    if (e instanceof Error) return { error: e.message }
    return { error: 'Unexpected error during AI generation' }
  }
}

// ── Save Dataset ──────────────────────────────────────────────────────────────

export async function saveDataset(data: {
  name: string
  description: string
  columns: string[]
  records: Record<string, string>[]
  aiGenerated: boolean
  aiPrompt: string
}): Promise<{ id?: string; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: { session } } = await supabase.auth.getSession()
  const orgId = session?.access_token
    ? JSON.parse(atob(session.access_token.split('.')[1]))?.org_id
    : null
  if (!orgId) return { error: 'Organisation not found' }

  const { data: inserted, error } = await supabase
    .from('test_datasets')
    .insert({
      org_id:       orgId,
      name:         data.name.trim(),
      description:  data.description.trim() || null,
      columns:      data.columns,
      records:      data.records,
      row_count:    data.records.length,
      ai_generated: data.aiGenerated,
      ai_prompt:    data.aiPrompt || null,
      created_by:   user.id,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  await logAuditEvent({
    action:      'test_data.dataset_saved',
    entity_type: 'test_dataset',
    entity_id:   inserted.id,
    entity_name: data.name.trim(),
    details:     { row_count: data.records.length, ai_generated: data.aiGenerated },
    user_id:     user.id,
    user_email:  user.email ?? undefined,
    org_id:      orgId,
  })

  return { id: inserted.id }
}

// ── Get Datasets ──────────────────────────────────────────────────────────────

export async function getDatasets(): Promise<{ datasets: SavedDataset[]; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { datasets: [], error: 'Not authenticated' }

  const { data, error } = await supabase
    .from('test_datasets')
    .select('id, name, description, columns, records, row_count, ai_generated, ai_prompt, created_at')
    .order('created_at', { ascending: false })

  if (error) return { datasets: [], error: error.message }
  return { datasets: (data as SavedDataset[]) ?? [] }
}

// ── Delete Dataset ────────────────────────────────────────────────────────────

export async function deleteDataset(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: { session } } = await supabase.auth.getSession()
  const orgId = session?.access_token
    ? JSON.parse(atob(session.access_token.split('.')[1]))?.org_id
    : null

  const { data: existing } = await supabase
    .from('test_datasets')
    .select('name')
    .eq('id', id)
    .single()

  const { error } = await supabase.from('test_datasets').delete().eq('id', id)
  if (error) return { error: error.message }

  await logAuditEvent({
    action:      'test_data.dataset_deleted',
    entity_type: 'test_dataset',
    entity_id:   id,
    entity_name: existing?.name ?? id,
    user_id:     user.id,
    user_email:  user.email ?? undefined,
    org_id:      orgId ?? undefined,
  })

  return {}
}

// ── AI Search Logs ────────────────────────────────────────────────────────────

export async function getAiSearchLogs(
  source?: string,
  limit = 10
): Promise<AiSearchLog[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  let query = supabase
    .from('ai_search_logs')
    .select('id, source, prompt, result, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (source) query = query.eq('source', source)

  const { data } = await query
  return (data as AiSearchLog[]) ?? []
}

export async function getLearnedTemplates(): Promise<LearnedTemplate[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data } = await supabase
    .from('ai_learned_templates')
    .select('id, ext, filename, description, content, mime_type, created_at')
    .order('created_at', { ascending: false })

  return (data as LearnedTemplate[]) ?? []
}
