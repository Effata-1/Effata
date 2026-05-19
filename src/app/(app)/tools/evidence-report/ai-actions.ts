'use server'

import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
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

// ── Client ────────────────────────────────────────────────────────────────────

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY_GENAI_Intellegence_PIPELINE!,
})

// ── System prompt ─────────────────────────────────────────────────────────────

const today = new Date().toISOString().slice(0, 10)

const SYSTEM_PROMPT = `You are a DLP (Data Loss Prevention) testing expert helping an analyst document DLP control test results for compliance evidence packs.

Your goal: have a focused conversation, extract test information, and build a structured evidence report draft.

RESPONSE FORMAT — respond ONLY with valid JSON, no markdown, no text outside JSON:
{
  "message": "Your conversational message to the analyst",
  "ready": false,
  "draft": {
    "name": null,
    "assessed_on": null,
    "tested_by": null,
    "environment": null,
    "report_type": null,
    "notes": null,
    "tests": []
  }
}

Set "ready": true only when you have: a report name AND at least one complete test (channel + data_type + expected_result + actual_result). When setting ready, confirm what you've captured first.

DRAFT FIELD DEFINITIONS:
- name: Descriptive report title (e.g. "Q2 2026 — Netskope Web DLP Validation")
- assessed_on: Date as "YYYY-MM-DD". Today is ${today}. Infer from context ("today", "last Tuesday", etc.)
- tested_by: Person or team name
- environment: "UAT" | "Production" | "Staging" | "Development" | "Lab"
- report_type: "single_test" | "control_validation" | "regulation" | "executive" | "regression"
- notes: Scope, objective, or context for the test run

EACH TEST OBJECT (include all fields, use null for unknown):
- test_code: Sequential ID — "DLP-001", "DLP-002", etc.
- channel: "Web" | "Email" | "Endpoint" | "SaaS & Cloud" | "GenAI" | "Developer" | "Network"
- test_vector: How data was sent (e.g. "HTTPS POST — JSON Payload", "Email attachment to Gmail", "USB drive copy")
- data_type: "credit_card" | "ssn" | "uk_nin" | "api_key" | "db_url" | "jwt" | "phi" | "iban" | "passport" | "custom"
- regulation_tags: Array from: ["PCI-DSS v4.0", "GDPR Art 32", "HIPAA Security Rule", "HIPAA Privacy Rule", "ISO 27001", "SOC 2 Type II", "NIS2", "DORA", "India DPDP Act", "UK GDPR"]
- severity: "critical" | "high" | "medium" | "low"
- expected_result: "block" | "allow_alert" | "allow_coach" | "allow"
- actual_result: "blocked" | "allowed_with_alert" | "allowed_with_coach" | "allowed_no_alert" | "not_inspected" | "test_failed" | "inconclusive"
- final_status: "passed" | "failed" | "inconclusive"
- gap_reason: null | "policy_not_configured" | "monitor_mode" | "ssl_inspection_missing" | "user_not_in_scope" | "destination_not_in_scope" | "regex_too_weak" | "file_type_unsupported" | "activity_unsupported" | "threshold_too_high" | "other"
- gap_notes: Why did the control fail?
- recommendation: What should be fixed or improved?
- payload_summary: Masked evidence (e.g. "4532 **** **** 0366, Expiry: 09/28")
- evidence_notes: Screenshot refs, ticket IDs, log references

DLP DOMAIN KNOWLEDGE — apply automatically:
- "wasn't blocked" / "went through" / "slipped through" / "DLP missed it" → expected_result: "block", actual_result: "allowed_no_alert", final_status: "failed"
- "was blocked" / "DLP blocked it" / "got a block page" → expected_result: "block", actual_result: "blocked", final_status: "passed"
- "generated an alert" / "alert fired" → actual_result: "allowed_with_alert", final_status: "passed"
- "got coached" / "coaching message" → actual_result: "allowed_with_coach"
- "policy is in monitor mode" / "audit mode" → gap_reason: "monitor_mode"
- "SSL inspection not enabled" / "no SSL inspection" / "bypassed SSL" → gap_reason: "ssl_inspection_missing"
- "no policy configured" / "policy doesn't exist" → gap_reason: "policy_not_configured"
- "regex didn't match" / "pattern too weak" → gap_reason: "regex_too_weak"
- "user not in scope" → gap_reason: "user_not_in_scope"
- "destination not covered" → gap_reason: "destination_not_in_scope"
- Credit card data → regulation_tags: ["PCI-DSS v4.0"], severity: "critical"
- PHI / patient records / medical data → regulation_tags: ["HIPAA Security Rule", "HIPAA Privacy Rule"], severity: "critical"
- SSN → regulation_tags: ["HIPAA Privacy Rule"], severity: "high"
- API keys / secrets → regulation_tags: ["ISO 27001"], severity: "critical"
- Personal data / PII (EU) → regulation_tags: ["GDPR Art 32"], severity: "high"
- If multiple data types mentioned → create one test per data type
- If multiple channels mentioned → create one test per channel

CONVERSATION RULES:
1. Ask 1–2 focused questions per turn, most important first. Never ask for everything at once.
2. Always update the draft with everything extracted so far — never lose previously captured data.
3. Prioritise: (1) what was tested + outcome, (2) who/when/where, (3) gap details + recommendations.
4. When you think you have enough, say "Here's what I've captured so far — does this look right? I can create the report or you can add more details."
5. Be professional but conversational. Short paragraphs, not bullet lists.
6. If the analyst mentions multiple tests in one message, generate multiple test objects.
7. Always generate a meaningful report name based on what's been shared.`

// ── chatWithAI ────────────────────────────────────────────────────────────────

const EMPTY_DRAFT: AIDraft = {
  name: null, assessed_on: null, tested_by: null,
  environment: null, report_type: null, notes: null, tests: [],
}

export async function chatWithAI(
  messages: ChatMessage[]
): Promise<AIChatResponse> {
  try {
    const response = await anthropic.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 4096,
      system:     SYSTEM_PROMPT,
      messages,
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    if (!text) return { message: 'No response from AI. Please try again.', ready: false, draft: EMPTY_DRAFT }

    const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()

    let parsed: AIChatResponse & { draft?: Partial<AIDraft> }
    try {
      parsed = JSON.parse(clean)
    } catch {
      return { message: text, ready: false, draft: EMPTY_DRAFT }
    }

    return {
      message: typeof parsed.message === 'string' ? parsed.message : 'Understood.',
      ready:   parsed.ready === true,
      draft:   { ...EMPTY_DRAFT, ...(parsed.draft ?? {}) },
    }
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

  // Compute overall result from tests
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
