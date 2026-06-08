'use server'

import { createClient } from '@/lib/supabase/server'
import { logAuditEvent } from '@/lib/audit'

// ── Types ─────────────────────────────────────────────────────────────────────

export type OverallResult  = 'passed' | 'partially_passed' | 'failed' | 'inconclusive'
export type ReportType     = 'single_test' | 'control_validation' | 'regulation' | 'executive' | 'regression'
export type Severity       = 'critical' | 'high' | 'medium' | 'low'
export type ExpectedResult = 'block' | 'allow_alert' | 'allow_coach' | 'allow'
export type ActualResult   =
  | 'blocked' | 'allowed_with_alert' | 'allowed_with_coach'
  | 'allowed_no_alert' | 'not_inspected' | 'test_failed' | 'inconclusive'
export type FinalStatus    = 'passed' | 'failed' | 'inconclusive'
export type GapReason      =
  | 'policy_not_configured' | 'monitor_mode' | 'ssl_inspection_missing'
  | 'user_not_in_scope' | 'destination_not_in_scope' | 'regex_too_weak'
  | 'file_type_unsupported' | 'activity_unsupported' | 'threshold_too_high' | 'other'

export interface ReportSummary {
  id:             string
  name:           string
  report_type:    ReportType
  environment:    string
  assessed_on:    string
  overall_result: OverallResult
  test_count:     number
  created_at:     string
  status:         'draft' | 'complete'
}

export interface Attachment {
  id:         string
  file_name:  string
  file_type:  string
  file_size:  number
  signedUrl:  string
  test_id:    string | null
  created_at: string
}

export interface EvidenceReport {
  id:             string
  name:           string
  assessed_on:    string
  tested_by:      string
  environment:    string
  report_type:    ReportType
  overall_result: OverallResult
  notes:          string | null
  created_at:     string
}

export interface ReportTest {
  id:                   string
  report_id:            string
  test_code:            string
  channel:              string
  test_vector:          string
  data_type:            string
  regulation_tags:      string[]
  control_mapping:      string | null
  severity:             Severity
  expected_result:      ExpectedResult
  expected_policy:      string | null
  expected_alert:       boolean
  expected_description: string | null
  actual_result:        ActualResult
  http_response_code:   number | null
  response_time_ms:     number | null
  dlp_alert_generated:  boolean | null
  final_status:         FinalStatus
  gap_reason:           GapReason | null
  gap_notes:            string | null
  recommendation:       string | null
  payload_summary:      string | null
  data_source:          string
  evidence_notes:       string | null
  linked_test_id:       string | null
  sort_order:           number
  created_at:           string
}

// Validator test result (for import picker)
export interface ValidatorResult {
  id:               string
  test_name:        string
  protocol:         string
  data_type:        string
  destination:      string
  result:           'blocked' | 'not_blocked' | 'error'
  response_code:    number | null
  response_time_ms: number | null
  created_at:       string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getOrgId(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) return null
  try {
    return JSON.parse(atob(session.access_token.split('.')[1]))?.org_id ?? null
  } catch {
    return null
  }
}

// ── Report CRUD ───────────────────────────────────────────────────────────────

export async function createReport(data: {
  name:           string
  assessedOn:     string
  testedBy:       string
  environment:    string
  reportType:     ReportType
  overallResult?: OverallResult
  notes:          string
}): Promise<{ id?: string; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  const orgId = await getOrgId(supabase)
  if (!orgId) return { error: 'Organisation not found' }

  const { data: inserted, error } = await supabase
    .from('evidence_reports')
    .insert({
      org_id:         orgId,
      created_by:     user.id,
      name:           data.name.trim(),
      assessed_on:    data.assessedOn,
      tested_by:      data.testedBy.trim(),
      environment:    data.environment,
      report_type:    data.reportType,
      overall_result: data.overallResult ?? 'inconclusive',
      notes:          data.notes.trim() || null,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  await logAuditEvent({
    action: 'evidence_report.created', entity_type: 'evidence_report',
    entity_id: inserted.id, entity_name: data.name.trim(),
    user_id: user.id, user_email: user.email ?? undefined, org_id: orgId,
  })

  return { id: inserted.id }
}

export async function updateReport(
  id: string,
  data: Partial<{
    name:           string
    assessedOn:     string
    testedBy:       string
    environment:    string
    reportType:     ReportType
    overallResult:  OverallResult
    notes:          string
  }>
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const patch: Record<string, unknown> = {}
  if (data.name           !== undefined) patch.name           = data.name.trim()
  if (data.assessedOn     !== undefined) patch.assessed_on    = data.assessedOn
  if (data.testedBy       !== undefined) patch.tested_by      = data.testedBy.trim()
  if (data.environment    !== undefined) patch.environment     = data.environment
  if (data.reportType     !== undefined) patch.report_type    = data.reportType
  if (data.overallResult  !== undefined) patch.overall_result = data.overallResult
  if (data.notes          !== undefined) patch.notes          = data.notes.trim() || null

  const { error } = await supabase.from('evidence_reports').update(patch).eq('id', id)
  if (error) return { error: error.message }
  return {}
}

export async function deleteReport(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  const orgId = await getOrgId(supabase)

  const { data: existing } = await supabase
    .from('evidence_reports').select('name').eq('id', id).single()

  const { error } = await supabase.from('evidence_reports').delete().eq('id', id)
  if (error) return { error: error.message }

  await logAuditEvent({
    action: 'evidence_report.deleted', entity_type: 'evidence_report',
    entity_id: id, entity_name: existing?.name ?? id,
    user_id: user.id, user_email: user.email ?? undefined, org_id: orgId ?? undefined,
  })

  return {}
}

export async function getReports(): Promise<{ reports: ReportSummary[]; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { reports: [], error: 'Not authenticated' }

  const { data: reports, error: rErr } = await supabase
    .from('evidence_reports')
    .select('id, name, report_type, environment, assessed_on, overall_result, created_at, status')
    .order('created_at', { ascending: false })

  if (rErr) return { reports: [], error: rErr.message }
  if (!reports?.length) return { reports: [] }

  // Fetch test counts per report
  const ids = reports.map(r => r.id)
  const { data: counts } = await supabase
    .from('report_tests')
    .select('report_id')
    .in('report_id', ids)

  const countMap: Record<string, number> = {}
  for (const c of counts ?? []) countMap[c.report_id] = (countMap[c.report_id] ?? 0) + 1

  return {
    reports: reports.map(r => ({
      ...r,
      test_count: countMap[r.id] ?? 0,
    })) as ReportSummary[],
  }
}

export async function getReport(
  id: string
): Promise<{ report?: EvidenceReport; tests: ReportTest[]; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { tests: [], error: 'Not authenticated' }

  const [{ data: report, error: rErr }, { data: tests, error: tErr }] = await Promise.all([
    supabase.from('evidence_reports').select('*').eq('id', id).single(),
    supabase.from('report_tests').select('*').eq('report_id', id).order('sort_order'),
  ])

  if (rErr) return { tests: [], error: rErr.message }
  if (tErr) return { tests: [], error: tErr.message }

  return { report: report as EvidenceReport, tests: (tests ?? []) as ReportTest[] }
}

// ── Test CRUD ─────────────────────────────────────────────────────────────────

export async function addTest(
  reportId: string,
  data: {
    testCode:            string
    channel:             string
    testVector:          string
    dataType:            string
    regulationTags:      string[]
    controlMapping:      string
    severity:            Severity
    expectedResult:      ExpectedResult
    expectedPolicy:      string
    expectedAlert:       boolean
    expectedDescription: string
    actualResult:        ActualResult
    httpResponseCode:    number | null
    responseTimeMs:      number | null
    dlpAlertGenerated:   boolean | null
    finalStatus:         FinalStatus
    gapReason:           GapReason | null
    gapNotes:            string
    recommendation:      string
    payloadSummary:      string
    dataSource:          string
    evidenceNotes:       string
    linkedTestId:        string | null
    sortOrder:           number
  }
): Promise<{ id?: string; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  const orgId = await getOrgId(supabase)
  if (!orgId) return { error: 'Organisation not found' }

  const { data: inserted, error } = await supabase
    .from('report_tests')
    .insert({
      org_id:               orgId,
      report_id:            reportId,
      test_code:            data.testCode.trim(),
      channel:              data.channel,
      test_vector:          data.testVector.trim(),
      data_type:            data.dataType,
      regulation_tags:      data.regulationTags,
      control_mapping:      data.controlMapping.trim() || null,
      severity:             data.severity,
      expected_result:      data.expectedResult,
      expected_policy:      data.expectedPolicy.trim() || null,
      expected_alert:       data.expectedAlert,
      expected_description: data.expectedDescription.trim() || null,
      actual_result:        data.actualResult,
      http_response_code:   data.httpResponseCode,
      response_time_ms:     data.responseTimeMs,
      dlp_alert_generated:  data.dlpAlertGenerated,
      final_status:         data.finalStatus,
      gap_reason:           data.gapReason,
      gap_notes:            data.gapNotes.trim() || null,
      recommendation:       data.recommendation.trim() || null,
      payload_summary:      data.payloadSummary.trim() || null,
      data_source:          data.dataSource,
      evidence_notes:       data.evidenceNotes.trim() || null,
      linked_test_id:       data.linkedTestId || null,
      sort_order:           data.sortOrder,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }
  return { id: inserted.id }
}

export async function updateTest(
  testId: string,
  data: Partial<Parameters<typeof addTest>[1]>
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const patch: Record<string, unknown> = {}
  if (data.testCode            !== undefined) patch.test_code            = data.testCode.trim()
  if (data.channel             !== undefined) patch.channel              = data.channel
  if (data.testVector          !== undefined) patch.test_vector          = data.testVector.trim()
  if (data.dataType            !== undefined) patch.data_type            = data.dataType
  if (data.regulationTags      !== undefined) patch.regulation_tags      = data.regulationTags
  if (data.controlMapping      !== undefined) patch.control_mapping      = data.controlMapping.trim() || null
  if (data.severity            !== undefined) patch.severity             = data.severity
  if (data.expectedResult      !== undefined) patch.expected_result      = data.expectedResult
  if (data.expectedPolicy      !== undefined) patch.expected_policy      = data.expectedPolicy.trim() || null
  if (data.expectedAlert       !== undefined) patch.expected_alert       = data.expectedAlert
  if (data.expectedDescription !== undefined) patch.expected_description = data.expectedDescription.trim() || null
  if (data.actualResult        !== undefined) patch.actual_result        = data.actualResult
  if (data.httpResponseCode    !== undefined) patch.http_response_code   = data.httpResponseCode
  if (data.responseTimeMs      !== undefined) patch.response_time_ms     = data.responseTimeMs
  if (data.dlpAlertGenerated   !== undefined) patch.dlp_alert_generated  = data.dlpAlertGenerated
  if (data.finalStatus         !== undefined) patch.final_status         = data.finalStatus
  if (data.gapReason           !== undefined) patch.gap_reason           = data.gapReason
  if (data.gapNotes            !== undefined) patch.gap_notes            = data.gapNotes.trim() || null
  if (data.recommendation      !== undefined) patch.recommendation       = data.recommendation.trim() || null
  if (data.payloadSummary      !== undefined) patch.payload_summary      = data.payloadSummary.trim() || null
  if (data.dataSource          !== undefined) patch.data_source          = data.dataSource
  if (data.evidenceNotes       !== undefined) patch.evidence_notes       = data.evidenceNotes.trim() || null

  const { error } = await supabase.from('report_tests').update(patch).eq('id', testId)
  if (error) return { error: error.message }
  return {}
}

export async function deleteTest(testId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  const { error } = await supabase.from('report_tests').delete().eq('id', testId)
  if (error) return { error: error.message }
  return {}
}

// ── Import from Control Validator ─────────────────────────────────────────────

export async function getValidatorResults(): Promise<{ results: ValidatorResult[]; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { results: [], error: 'Not authenticated' }

  const { data, error } = await supabase
    .from('dlp_test_results')
    .select('id, test_name, protocol, data_type, destination, result, response_code, response_time_ms, created_at')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return { results: [], error: error.message }
  return { results: (data ?? []) as ValidatorResult[] }
}

export async function importFromValidator(
  reportId: string,
  testResultIds: string[]
): Promise<{ count: number; error?: string }> {
  if (!testResultIds.length) return { count: 0 }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { count: 0, error: 'Not authenticated' }
  const orgId = await getOrgId(supabase)
  if (!orgId) return { count: 0, error: 'Organisation not found' }

  const { data: results, error: fetchErr } = await supabase
    .from('dlp_test_results')
    .select('id, test_name, protocol, data_type, destination, result, response_code, response_time_ms, created_at')
    .in('id', testResultIds)

  if (fetchErr) return { count: 0, error: fetchErr.message }

  // Get current max sort_order for this report
  const { data: existing } = await supabase
    .from('report_tests').select('sort_order').eq('report_id', reportId).order('sort_order', { ascending: false }).limit(1)
  let nextOrder = (existing?.[0]?.sort_order ?? -1) + 1

  // Get current test count for auto-generating test codes
  const { count: currentCount } = await supabase
    .from('report_tests').select('*', { count: 'exact', head: true }).eq('report_id', reportId)
  let testNum = (currentCount ?? 0) + 1

  const PROTOCOL_LABELS: Record<string, string> = {
    https_post_text: 'HTTPS POST — Plain Text', https_post_json: 'HTTPS POST — JSON Payload',
    https_post_form: 'HTTPS POST — Form Data', https_file_upload: 'HTTPS File Upload',
    https_get_param: 'HTTPS GET Parameter', base64_post: 'HTTPS POST — Base64 Encoded',
    custom_file: 'File Upload (Custom)',
    script_ftp: 'FTP — Port 21', script_smtp: 'SMTP — Port 587', script_dns: 'DNS Exfiltration',
    script_curl: 'HTTPS — cURL Script', script_powershell: 'HTTPS — PowerShell Script',
  }

  const CHANNEL_MAP: Record<string, string> = {
    https_post_text: 'Web', https_post_json: 'Web', https_post_form: 'Web',
    https_file_upload: 'Web', https_get_param: 'Web', base64_post: 'Web', custom_file: 'Web',
    script_ftp: 'Network', script_smtp: 'Email', script_dns: 'Network',
    script_curl: 'Web', script_powershell: 'Web',
  }

  // Map dlp_test_results result to report_tests fields
  function mapResult(r: string): { actual_result: ActualResult; final_status: FinalStatus } {
    if (r === 'blocked')            return { actual_result: 'blocked',           final_status: 'passed' }
    if (r === 'not_blocked')        return { actual_result: 'allowed_no_alert',   final_status: 'failed' }
    if (r === 'user_alert_proceed') return { actual_result: 'allowed_with_coach', final_status: 'failed' }
    if (r === 'user_alert_stop')    return { actual_result: 'allowed_with_coach', final_status: 'inconclusive' }
    if (r === 'blocked_coached')    return { actual_result: 'blocked',            final_status: 'passed' }
    return                                 { actual_result: 'test_failed',        final_status: 'inconclusive' }
  }

  const rows = (results ?? []).map(r => {
    const mapped = mapResult(r.result)
    const code = `DLP-${testNum++}`.padStart(3, '0')
    const row = {
      org_id:             orgId,
      report_id:          reportId,
      test_code:          code,
      channel:            CHANNEL_MAP[r.protocol] ?? 'Web',
      test_vector:        PROTOCOL_LABELS[r.protocol] ?? r.test_name,
      data_type:          r.data_type,
      regulation_tags:    [] as string[],
      severity:           'medium' as Severity,
      expected_result:    'block' as ExpectedResult,
      expected_alert:     true,
      actual_result:      mapped.actual_result,
      http_response_code: r.response_code ?? null,
      response_time_ms:   r.response_time_ms ?? null,
      final_status:       mapped.final_status,
      data_source:        'Control Validator (Synthetic)',
      linked_test_id:     r.id,
      sort_order:         nextOrder++,
    }
    return row
  })

  const { error: insertErr } = await supabase.from('report_tests').insert(rows)
  if (insertErr) return { count: 0, error: insertErr.message }

  return { count: rows.length }
}

// ── Read tests for a report (used for live state updates post-mutation) ────────

export async function getTests(reportId: string): Promise<{ tests: ReportTest[]; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { tests: [], error: 'Not authenticated' }
  const { data, error } = await supabase
    .from('report_tests')
    .select('*')
    .eq('report_id', reportId)
    .order('sort_order')
  if (error) return { tests: [], error: error.message }
  return { tests: (data ?? []) as ReportTest[] }
}

// ── File attachments ──────────────────────────────────────────────────────────

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

const ALLOWED_MIMES = new Set([
  'image/png', 'image/jpeg', 'image/gif', 'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/csv', 'text/plain',
])

// Magic byte checks — verify actual file content matches the claimed MIME type.
// A malicious caller can set file.type to anything; this check cannot be bypassed
// because it reads the decoded bytes, not the client-supplied string.
const MAGIC_CHECKS: Record<string, (b: Buffer) => boolean> = {
  'image/png':  b => b[0]===0x89 && b[1]===0x50 && b[2]===0x4E && b[3]===0x47,
  'image/jpeg': b => b[0]===0xFF && b[1]===0xD8 && b[2]===0xFF,
  'image/gif':  b => b[0]===0x47 && b[1]===0x49 && b[2]===0x46,
  'image/webp': b => b[0]===0x52 && b[1]===0x49 && b[2]===0x46 && b[3]===0x46
                  && b[8]===0x57 && b[9]===0x45 && b[10]===0x42 && b[11]===0x50,
  'application/pdf': b => b[0]===0x25 && b[1]===0x50 && b[2]===0x44 && b[3]===0x46,
  // DOC: OLE2 signature D0 CF 11 E0
  'application/msword': b => b[0]===0xD0 && b[1]===0xCF && b[2]===0x11 && b[3]===0xE0,
  // DOCX: ZIP/PK signature (Office Open XML is a zip file)
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    b => b[0]===0x50 && b[1]===0x4B,
  // Text files: no null bytes in first 512 bytes (binary content check)
  'text/csv':   b => !b.slice(0, 512).includes(0x00),
  'text/plain': b => !b.slice(0, 512).includes(0x00),
}

export async function uploadAttachment(
  reportId: string,
  file: { name: string; type: string; size: number; base64: string },
  testId?: string,
): Promise<{ id?: string; signedUrl?: string; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  const orgId = await getOrgId(supabase)
  if (!orgId) return { error: 'Organisation not found' }

  // 1. Verify report ownership before touching storage or inserting rows
  const { data: reportRow, error: reportErr } = await supabase
    .from('evidence_reports')
    .select('id, org_id')
    .eq('id', reportId)
    .eq('org_id', orgId)
    .single()

  if (reportErr || !reportRow) return { error: 'Report not found or access denied' }

  // 1b. If a testId was supplied, confirm it belongs to this same report (and thus org)
  if (testId) {
    const { data: testRow, error: testErr } = await supabase
      .from('report_tests')
      .select('id')
      .eq('id', testId)
      .eq('report_id', reportId)
      .single()

    if (testErr || !testRow) return { error: 'Test not found or does not belong to this report' }
  }

  // 2. Reject oversized uploads (client-reported size)
  if (file.size > MAX_FILE_SIZE) return { error: 'File exceeds 10 MB limit' }

  // 3. Reject disallowed MIME types
  if (!ALLOWED_MIMES.has(file.type)) return { error: `File type "${file.type}" is not allowed` }

  // 5. Decode base64 on the server
  const decoded = Buffer.from(file.base64, 'base64')

  // 6. Verify actual byte length matches claimed size and is within limit
  if (decoded.byteLength !== file.size) return { error: 'File size mismatch — upload rejected' }
  if (decoded.byteLength > MAX_FILE_SIZE) return { error: 'Decoded file exceeds 10 MB limit' }

  // 7. Magic byte check — verify file content matches claimed MIME type.
  //     This cannot be bypassed because it reads decoded bytes, not client-supplied type.
  const magicOk = MAGIC_CHECKS[file.type]?.(decoded)
  if (magicOk === false) {
    return { error: `File content does not match declared type "${file.type}" — upload rejected` }
  }
  if (magicOk === undefined) {
    // No check registered for this MIME (should not happen — ALLOWED_MIMES guards entry)
    return { error: 'File type validation not available — upload rejected' }
  }

  // 6. Server-generated UUID path — original filename never used in storage path
  const { randomUUID } = await import('crypto')
  const storagePath = `${orgId}/${reportId}/${randomUUID()}`

  // 7. Upload to Supabase storage
  const { error: uploadErr } = await supabase.storage
    .from('evidence-attachments')
    .upload(storagePath, decoded, { contentType: file.type })
  if (uploadErr) return { error: uploadErr.message }

  // 8. Sanitize display filename
  const path = await import('path')
  const safeName = path.basename(file.name).replace(/[^a-zA-Z0-9._\-]/g, '_')

  // 9. Insert DB row
  const { data: inserted, error: dbErr } = await supabase
    .from('report_attachments')
    .insert({
      org_id:      orgId,
      report_id:   reportId,
      test_id:     testId ?? null,
      file_name:   safeName,
      file_path:   storagePath,
      file_type:   file.type,
      file_size:   decoded.byteLength,
      uploaded_by: user.id,
    })
    .select('id')
    .single()

  if (dbErr) {
    // Clean up orphaned storage object
    await supabase.storage.from('evidence-attachments').remove([storagePath])
    return { error: dbErr.message }
  }

  // 10. Return signed URL (1 hour)
  const { data: signed } = await supabase.storage
    .from('evidence-attachments')
    .createSignedUrl(storagePath, 3600)

  return { id: inserted.id, signedUrl: signed?.signedUrl }
}

export async function deleteAttachment(attachmentId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  const orgId = await getOrgId(supabase)
  if (!orgId) return { error: 'Organisation not found' }

  // Fetch row — verify org ownership
  const { data: row, error: fetchErr } = await supabase
    .from('report_attachments')
    .select('id, file_path, org_id')
    .eq('id', attachmentId)
    .single()

  if (fetchErr || !row) return { error: 'Attachment not found' }
  if (row.org_id !== orgId) return { error: 'Not authorised' }

  // Remove from storage first
  await supabase.storage.from('evidence-attachments').remove([row.file_path])

  // Delete DB row
  const { error: delErr } = await supabase
    .from('report_attachments')
    .delete()
    .eq('id', attachmentId)

  if (delErr) return { error: delErr.message }
  return {}
}

export async function getAttachments(reportId: string): Promise<Attachment[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: rows } = await supabase
    .from('report_attachments')
    .select('id, file_name, file_type, file_size, file_path, test_id, created_at')
    .eq('report_id', reportId)
    .order('created_at')

  if (!rows?.length) return []

  // Generate signed URLs in parallel
  const attachments = await Promise.all(
    rows.map(async (row) => {
      const { data: signed } = await supabase.storage
        .from('evidence-attachments')
        .createSignedUrl(row.file_path, 3600)
      return {
        id:         row.id as string,
        file_name:  row.file_name as string,
        file_type:  row.file_type as string,
        file_size:  row.file_size as number,
        signedUrl:  signed?.signedUrl ?? '',
        test_id:    row.test_id as string | null,
        created_at: row.created_at as string,
      }
    })
  )

  return attachments
}
