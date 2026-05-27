'use server'

import { callAgent } from '@/lib/api-client'
import { createClient } from '@/lib/supabase/server'
import { logAiSearch } from '@/lib/ai-log'
import type {
  ReportType, OverallResult, Severity, ExpectedResult, ActualResult, FinalStatus, GapReason,
} from './actions'

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
