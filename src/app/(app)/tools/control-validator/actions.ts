'use server'

import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { logAuditEvent } from '@/lib/audit'

// ── Types ─────────────────────────────────────────────────────────────────────

export type TestResult = 'blocked' | 'not_blocked' | 'error' | 'user_alert_proceed' | 'user_alert_stop' | 'blocked_coached'

export interface TestHistoryEntry {
  id:               string
  test_name:        string
  protocol:         string
  data_type:        string
  destination:      string
  result:           TestResult
  response_code:    number | null
  response_time_ms: number | null
  created_at:       string
}

// ── Save result ───────────────────────────────────────────────────────────────

export async function saveTestResult(data: {
  testName:       string
  protocol:       string
  dataType:       string
  destination:    string
  result:         TestResult
  responseCode?:  number
  responseTimeMs?: number
}): Promise<{ id?: string; error?: string }> {
  const user = await requireRole('analyst')
  const orgId = user.orgId
  const supabase = await createClient()

  const { data: inserted, error } = await supabase
    .from('dlp_test_results')
    .insert({
      org_id:          orgId,
      user_id:         user.id,
      test_name:       data.testName,
      protocol:        data.protocol,
      data_type:       data.dataType,
      destination:     data.destination,
      result:          data.result,
      response_code:   data.responseCode   ?? null,
      response_time_ms: data.responseTimeMs ?? null,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  await logAuditEvent({
    action:      'dlp_test.run',
    entity_type: 'dlp_test',
    entity_id:   inserted.id,
    entity_name: data.testName,
    details:     { protocol: data.protocol, data_type: data.dataType, result: data.result },
    user_id:     user.id,
    user_email:  user.email || undefined,
    org_id:      orgId,
  })

  return { id: inserted.id }
}

// ── Update result for user alert ──────────────────────────────────────────────

export async function updateTestResultUserAlert(
  id: string,
  newResult: 'user_alert_proceed' | 'user_alert_stop' | 'blocked_coached'
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('dlp_test_results')
    .update({ result: newResult })
    .eq('id', id)
    .eq('user_id', user.id)

  return error ? { error: error.message } : {}
}

// ── Get history ───────────────────────────────────────────────────────────────

export async function getTestHistory(): Promise<{ results: TestHistoryEntry[]; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { results: [] }

  const { data, error } = await supabase
    .from('dlp_test_results')
    .select('id, test_name, protocol, data_type, destination, result, response_code, response_time_ms, created_at')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return { results: [], error: error.message }
  return { results: (data as TestHistoryEntry[]) ?? [] }
}
