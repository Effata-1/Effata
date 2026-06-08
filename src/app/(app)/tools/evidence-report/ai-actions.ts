'use server'

import { callAgent } from '@/lib/api-client.server'
import { createClient } from '@/lib/supabase/server'
import { logAiSearch } from '@/lib/ai-log'
import type {
  ReportType, OverallResult, Severity, ExpectedResult, ActualResult, FinalStatus, GapReason,
} from './actions'

// ── DisplayMessage (mirrors the client-side type for conversation resume) ──────

export interface DisplayMessage {
  role: 'user' | 'assistant'
  text: string
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role:    'user' | 'assistant'
  content: string
}

export interface AIDraftTest {
  test_code:       string
  channel:         string
  test_vector:     string
  data_type:       string
  regulation_tags: string[]
  severity:        Severity
  expected_result: ExpectedResult
  actual_result:   ActualResult
  final_status:    FinalStatus
  gap_reason:      GapReason | null
  gap_notes:       string | null
  recommendation:  string | null
  payload_summary: string | null
  evidence_notes:  string | null
}

export interface AIDraft {
  name:        string | null
  assessed_on: string | null
  tested_by:   string | null
  environment: string | null
  report_type: ReportType | null
  notes:       string | null
  tests:       Partial<AIDraftTest>[]
}

export interface AIChatResponse {
  message: string
  ready:   boolean
  draft:   AIDraft
  error?:  string
}

const today = new Date().toISOString().slice(0, 10)

// ── chatWithAI ────────────────────────────────────────────────────────────────

const EMPTY_DRAFT: AIDraft = {
  name: null, assessed_on: null, tested_by: null,
  environment: null, report_type: null, notes: null, tests: [],
}

export async function chatWithAI(
  messages: ChatMessage[]
): Promise<AIChatResponse> {
  try {
    const result = await callAgent<AIChatResponse>('evidence', { messages })
    const userPrompt = messages[messages.length - 1]?.content ?? ''
    logAiSearch('evidence_report', userPrompt, typeof result.message === 'string' ? result.message.slice(0, 200) : undefined)
    return result
  } catch (err) {
    return {
      message: 'Something went wrong. Please try again.',
      ready:   false,
      draft:   EMPTY_DRAFT,
      error:   err instanceof Error ? err.message : String(err),
    }
  }
}

// ── createReportFromDraft ─────────────────────────────────────────────────────

export async function createReportFromDraft(
  draft: AIDraft
): Promise<{ id?: string; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: { session } } = await supabase.auth.getSession()
  const orgId: string | null = session?.access_token
    ? JSON.parse(atob(session.access_token.split('.')[1]))?.org_id ?? null
    : null
  if (!orgId) return { error: 'Organisation not found' }

  const tests = draft.tests ?? []

  const hasCriticalFail = tests.some(t => t.severity === 'critical' && t.final_status === 'failed')
  const anyFailed       = tests.some(t => t.final_status === 'failed')
  const allPassed       = tests.length > 0 && tests.every(t => t.final_status === 'passed')
  const overallResult: OverallResult =
    tests.length === 0   ? 'inconclusive' :
    hasCriticalFail      ? 'failed' :
    allPassed            ? 'passed' :
    anyFailed            ? 'partially_passed' :
                           'inconclusive'

  const { data: report, error: rErr } = await supabase
    .from('evidence_reports')
    .insert({
      org_id:         orgId,
      created_by:     user.id,
      name:           draft.name?.trim() || 'AI-Generated Report',
      assessed_on:    draft.assessed_on || today,
      tested_by:      draft.tested_by?.trim() || user.email || 'Unknown',
      environment:    draft.environment || 'UAT',
      report_type:    draft.report_type || 'control_validation',
      overall_result: overallResult,
      notes:          draft.notes?.trim() || null,
    })
    .select('id')
    .single()

  if (rErr) return { error: rErr.message }

  if (tests.length > 0) {
    const rows = tests.map((t, i) => ({
      org_id:             orgId,
      report_id:          report.id,
      test_code:          t.test_code || `DLP-${String(i + 1).padStart(3, '0')}`,
      channel:            t.channel || 'Web',
      test_vector:        t.test_vector || '',
      data_type:          t.data_type || 'custom',
      regulation_tags:    t.regulation_tags || [],
      severity:           (t.severity || 'medium') as Severity,
      expected_result:    (t.expected_result || 'block') as ExpectedResult,
      expected_alert:     true,
      actual_result:      (t.actual_result || 'inconclusive') as ActualResult,
      final_status:       (t.final_status || 'inconclusive') as FinalStatus,
      gap_reason:         t.gap_reason || null,
      gap_notes:          t.gap_notes || null,
      recommendation:     t.recommendation || null,
      payload_summary:    t.payload_summary || null,
      evidence_notes:     t.evidence_notes || null,
      data_source:        'AI-Assisted Entry',
      sort_order:         i,
    }))

    const { error: tErr } = await supabase.from('report_tests').insert(rows)
    if (tErr) return { error: tErr.message }
  }

  return { id: report.id }
}

// ── Draft persistence ─────────────────────────────────────────────────────────

async function getOrgAndUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, orgId: null }
  const { data: { session } } = await supabase.auth.getSession()
  const orgId: string | null = session?.access_token
    ? JSON.parse(atob(session.access_token.split('.')[1]))?.org_id ?? null
    : null
  return { supabase, user, orgId }
}

export async function saveDraft(
  draft: AIDraft,
  ready: boolean,
  apiMessages: ChatMessage[],
  displayMessages: DisplayMessage[],
): Promise<{ id?: string; error?: string }> {
  const { supabase, user, orgId } = await getOrgAndUser()
  if (!user || !orgId) return { error: 'Not authenticated' }

  const { data: row, error } = await supabase
    .from('evidence_reports')
    .insert({
      org_id:          orgId,
      created_by:      user.id,
      name:            draft.name?.trim() || 'AI Draft',
      assessed_on:     draft.assessed_on || new Date().toISOString().slice(0, 10),
      tested_by:       draft.tested_by?.trim() || user.email || 'Unknown',
      environment:     draft.environment || 'UAT',
      report_type:     draft.report_type || 'control_validation',
      overall_result:  'inconclusive',
      notes:           draft.notes?.trim() || null,
      status:          'draft',
      // Store full draft + exact ready flag so resume is pixel-perfect
      ai_conversation: { apiMessages, displayMessages, draft, ready },
    })
    .select('id')
    .single()

  if (error) return { error: error.message }
  return { id: row.id }
}

export async function updateDraft(
  id: string,
  draft: AIDraft,
  ready: boolean,
  apiMessages: ChatMessage[],
  displayMessages: DisplayMessage[],
): Promise<{ error?: string }> {
  const { supabase, user } = await getOrgAndUser()
  if (!user) return { error: 'Not authenticated' }

  const patch: Record<string, unknown> = {
    // Store full draft + exact ready flag alongside conversation history
    ai_conversation: { apiMessages, displayMessages, draft, ready },
  }
  if (draft.name)        patch.name         = draft.name.trim()
  if (draft.assessed_on) patch.assessed_on  = draft.assessed_on
  if (draft.tested_by)   patch.tested_by    = draft.tested_by.trim()
  if (draft.environment) patch.environment  = draft.environment
  if (draft.report_type) patch.report_type  = draft.report_type
  if (draft.notes)       patch.notes        = draft.notes.trim() || null

  const { error } = await supabase
    .from('evidence_reports')
    .update(patch)
    .eq('id', id)
    .eq('status', 'draft')   // guard: never update a completed report via this path

  if (error) return { error: error.message }
  return {}
}

export async function getDraft(id: string): Promise<{
  id: string
  fields: AIDraft
  ready: boolean
  apiMessages: ChatMessage[]
  displayMessages: DisplayMessage[]
} | null> {
  const { supabase, user, orgId } = await getOrgAndUser()
  if (!user || !orgId) return null

  const { data, error } = await supabase
    .from('evidence_reports')
    .select('id, name, assessed_on, tested_by, environment, report_type, notes, ai_conversation')
    .eq('id', id)
    .eq('org_id', orgId)
    .eq('status', 'draft')
    .single()

  if (error || !data) return null

  const conv = (data.ai_conversation ?? {}) as {
    apiMessages?:     ChatMessage[]
    displayMessages?: DisplayMessage[]
    draft?:           AIDraft
    ready?:           boolean    // exact AI-reported ready value, not inferred
  }

  // Prefer full draft from ai_conversation (has tests). Fall back to header-only
  // reconstruction for older drafts that pre-date this change.
  const restoredDraft: AIDraft = conv.draft ?? {
    name:        data.name as string | null,
    assessed_on: data.assessed_on as string | null,
    tested_by:   data.tested_by as string | null,
    environment: data.environment as string | null,
    report_type: data.report_type as ReportType | null,
    notes:       data.notes as string | null,
    tests:       [],
  }

  return {
    id:              data.id as string,
    fields:          restoredDraft,
    ready:           conv.ready ?? false,   // exact value; false if not yet saved (old draft)
    apiMessages:     conv.apiMessages    ?? [],
    displayMessages: conv.displayMessages ?? [],
  }
}

export async function finalizeDraft(
  id: string,
  draft: AIDraft,
): Promise<{ error?: string }> {
  const { supabase, user, orgId } = await getOrgAndUser()
  if (!user || !orgId) return { error: 'Not authenticated' }

  const tests = draft.tests ?? []

  // Step 1: Update header fields — keep status = 'draft' until all steps succeed
  const { error: headErr } = await supabase
    .from('evidence_reports')
    .update({
      name:          draft.name?.trim() || 'AI-Generated Report',
      assessed_on:   draft.assessed_on || new Date().toISOString().slice(0, 10),
      tested_by:     draft.tested_by?.trim() || user.email || 'Unknown',
      environment:   draft.environment || 'UAT',
      report_type:   draft.report_type || 'control_validation',
      notes:         draft.notes?.trim() || null,
    })
    .eq('id', id)
    .eq('org_id', orgId)

  if (headErr) return { error: headErr.message }

  // Step 2: Delete existing tests (handles double-finalize safely)
  const { error: delErr } = await supabase
    .from('report_tests')
    .delete()
    .eq('report_id', id)

  if (delErr) return { error: delErr.message }

  // Step 3: Insert current draft tests
  if (tests.length > 0) {
    const rows = tests.map((t, i) => ({
      org_id:          orgId,
      report_id:       id,
      test_code:       t.test_code || `DLP-${String(i + 1).padStart(3, '0')}`,
      channel:         t.channel || 'Web',
      test_vector:     t.test_vector || '',
      data_type:       t.data_type || 'custom',
      regulation_tags: t.regulation_tags || [],
      severity:        (t.severity || 'medium') as Severity,
      expected_result: (t.expected_result || 'block') as ExpectedResult,
      expected_alert:  true,
      actual_result:   (t.actual_result || 'inconclusive') as ActualResult,
      final_status:    (t.final_status || 'inconclusive') as FinalStatus,
      gap_reason:      t.gap_reason || null,
      gap_notes:       t.gap_notes || null,
      recommendation:  t.recommendation || null,
      payload_summary: t.payload_summary || null,
      evidence_notes:  t.evidence_notes || null,
      data_source:     'AI-Assisted Entry',
      sort_order:      i,
    }))

    const { error: testErr } = await supabase.from('report_tests').insert(rows)
    if (testErr) return { error: testErr.message }
  }

  // Step 4: Calculate overall_result
  const hasCriticalFail = tests.some(t => t.severity === 'critical' && t.final_status === 'failed')
  const anyFailed       = tests.some(t => t.final_status === 'failed')
  const allPassed       = tests.length > 0 && tests.every(t => t.final_status === 'passed')
  const overallResult: OverallResult =
    tests.length === 0  ? 'inconclusive' :
    hasCriticalFail     ? 'failed' :
    allPassed           ? 'passed' :
    anyFailed           ? 'partially_passed' :
                          'inconclusive'

  // Step 5: Flip to complete — only now is the report visible as completed
  const { error: finalErr } = await supabase
    .from('evidence_reports')
    .update({ overall_result: overallResult, status: 'complete' })
    .eq('id', id)

  if (finalErr) return { error: finalErr.message }
  return {}
}
