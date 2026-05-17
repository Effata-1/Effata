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

  const { error } = await supabase
    .from('compliance_assessments')
    .upsert(
      {
        org_id:        orgId,
        control_key:   controlKey,
        regulation_id: regulationId,
        status,
        notes:         notes ?? null,
        updated_at:    new Date().toISOString(),
      },
      { onConflict: 'org_id,control_key,regulation_id' }
    )

  if (error) return { error: error.message }

  await logAuditEvent({
    action:      'compliance.assessment_updated',
    entity_type: 'compliance_assessment',
    entity_name: controlKey,
    details:     { regulation_id: regulationId, status },
    user_id:     user.id,
    user_email:  user.email ?? undefined,
    org_id:      orgId,
  })

  return {}
}
