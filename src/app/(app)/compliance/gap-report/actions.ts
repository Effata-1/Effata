'use server'

import { createClient } from '@/lib/supabase/server'
import { logAuditEvent } from '@/lib/audit'
import type { ControlStatus } from '@/lib/compliance/controls'

export async function upsertAssessment(
  controlKey: string,
  regulationId: string,
  status: ControlStatus,
  notes?: string
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: { session } } = await supabase.auth.getSession()
  const orgId = session?.access_token
    ? JSON.parse(atob(session.access_token.split('.')[1]))?.org_id
    : null
  if (!orgId) return { error: 'Organisation not found' }

  // Fetch previous status for the audit trail
  const { data: existing } = await supabase
    .from('compliance_assessments')
    .select('status')
    .eq('org_id', orgId)
    .eq('control_key', controlKey)
    .eq('regulation_id', regulationId)
    .maybeSingle()

  const previousStatus = existing?.status ?? 'not_assessed'

  // Only include notes when explicitly provided — omitting preserves existing notes in DB
  const upsertData: Record<string, unknown> = {
    org_id:        orgId,
    control_key:   controlKey,
    regulation_id: regulationId,
    status,
    updated_at:    new Date().toISOString(),
  }
  if (notes !== undefined) {
    upsertData.notes = notes.trim() || null
  }

  const { error } = await supabase
    .from('compliance_assessments')
    .upsert(upsertData, { onConflict: 'org_id,control_key,regulation_id' })

  if (error) return { error: error.message }

  await logAuditEvent({
    action:      'compliance.assessment_updated',
    entity_type: 'compliance_assessment',
    entity_name: controlKey,
    old_value:   previousStatus,
    new_value:   status,
    details:     { regulation_id: regulationId, status },
    user_id:     user.id,
    user_email:  user.email ?? undefined,
    org_id:      orgId,
  })

  return {}
}

export async function getControlHistory(
  controlKey: string,
  regulationId: string
): Promise<{ created_at: string; user_email: string | null; old_value: string | null; new_value: string | null }[]> {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const orgId = session?.access_token
    ? JSON.parse(atob(session.access_token.split('.')[1]))?.org_id
    : null
  if (!orgId) return []

  const { data } = await supabase
    .from('audit_logs')
    .select('created_at, user_email, old_value, new_value')
    .eq('action', 'compliance.assessment_updated')
    .eq('entity_name', controlKey)
    .eq('org_id', orgId)
    .filter('details->>regulation_id', 'eq', regulationId)
    .order('created_at', { ascending: false })
    .limit(20)

  return data ?? []
}
