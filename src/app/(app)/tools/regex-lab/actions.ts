'use server'

import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { logAuditEvent } from '@/lib/audit'
import { logAiSearch } from '@/lib/ai-log'
import { callAgent } from '@/lib/api-client.server'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ConfidenceReport {
  matchAccuracy:     'good' | 'fair' | 'poor'
  falsePositiveRisk: 'low' | 'medium' | 'high'
  anchoring:         'strong' | 'weak'
  contextRequired:   boolean
  dlpSeverity:       'critical' | 'high' | 'medium' | 'low'
  recommendation:    string
}

export interface AiRegexResult {
  title:            string
  pattern:          string
  flags:            string
  explanation:      string
  testExamples:     string[]
  nonMatchExamples: string[]
  confidence:       ConfidenceReport
}

export interface SavedPattern {
  id: string
  name: string
  description: string | null
  pattern: string
  flags: string
  test_data: string | null
  ai_generated: boolean
  ai_explanation: string | null
  created_at: string
}

// ── AI Generation ─────────────────────────────────────────────────────────────

export async function generateRegex(
  prompt: string
): Promise<{ result?: AiRegexResult; error?: string }> {
  if (!prompt.trim()) return { error: 'Prompt is required' }

  try {
    const result = await callAgent<AiRegexResult>('regex', { prompt })
    logAiSearch('regex_lab', prompt, `${result.title}: /${result.pattern}/${result.flags}`)
    return { result }
  } catch (e) {
    if (e instanceof Error) return { error: e.message }
    return { error: 'Unexpected error during AI generation' }
  }
}

// ── Save Pattern ──────────────────────────────────────────────────────────────

export async function savePattern(data: {
  name: string
  description: string
  pattern: string
  flags: string
  testData: string
  aiGenerated: boolean
  aiExplanation: string
}): Promise<{ id?: string; error?: string }> {
  const user = await requireRole('analyst')
  const orgId = user.orgId
  const supabase = await createClient()

  const { data: inserted, error } = await supabase
    .from('regex_patterns')
    .insert({
      org_id:         orgId,
      name:           data.name.trim(),
      description:    data.description.trim() || null,
      pattern:        data.pattern,
      flags:          data.flags,
      test_data:      data.testData || null,
      ai_generated:   data.aiGenerated,
      ai_explanation: data.aiExplanation || null,
      created_by:     user.id,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  await logAuditEvent({
    action:      'regex.pattern_saved',
    entity_type: 'regex_pattern',
    entity_id:   inserted.id,
    entity_name: data.name.trim(),
    details:     { pattern: data.pattern, flags: data.flags, ai_generated: data.aiGenerated },
    user_id:     user.id,
    user_email:  user.email || undefined,
    org_id:      orgId,
  })

  return { id: inserted.id }
}

// ── Get Patterns ──────────────────────────────────────────────────────────────

export async function getPatterns(): Promise<{ patterns: SavedPattern[]; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { patterns: [], error: 'Not authenticated' }

  const { data, error } = await supabase
    .from('regex_patterns')
    .select('id, name, description, pattern, flags, test_data, ai_generated, ai_explanation, created_at')
    .order('created_at', { ascending: false })

  if (error) return { patterns: [], error: error.message }
  return { patterns: (data as SavedPattern[]) ?? [] }
}

// ── Delete Pattern ────────────────────────────────────────────────────────────

export async function deletePattern(id: string): Promise<{ error?: string }> {
  const user = await requireRole('analyst')
  const orgId = user.orgId
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('regex_patterns')
    .select('name')
    .eq('id', id)
    .single()

  const { error } = await supabase.from('regex_patterns').delete().eq('id', id)
  if (error) return { error: error.message }

  await logAuditEvent({
    action:      'regex.pattern_deleted',
    entity_type: 'regex_pattern',
    entity_id:   id,
    entity_name: existing?.name ?? id,
    user_id:     user.id,
    user_email:  user.email || undefined,
    org_id:      orgId,
  })

  return {}
}
