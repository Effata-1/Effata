'use server'

import { createClient } from '@/lib/supabase/server'
import { logAuditEvent } from '@/lib/audit'

export async function markRegulationVerified(
  regulationId: string,
  regulationName: string,
  changed: boolean,
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

  const { error: logError } = await supabase
    .from('compliance_verification_log')
    .insert({
      regulation_id: regulationId,
      org_id:        orgId,
      verified_by:   user.id,
      changed,
      notes:         notes ?? null,
    })
  if (logError) return { error: logError.message }

  await supabase
    .from('compliance_regulations')
    .update({ last_verified_at: new Date().toISOString() })
    .eq('id', regulationId)

  await logAuditEvent({
    action:      'compliance.regulation_verified',
    entity_type: 'compliance_regulation',
    entity_id:   regulationId,
    entity_name: regulationName,
    details:     { changed, notes },
    user_id:     user.id,
    user_email:  user.email ?? undefined,
    org_id:      orgId,
  })

  return {}
}
