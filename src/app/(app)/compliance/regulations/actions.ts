'use server'

import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { logAuditEvent } from '@/lib/audit'

export async function markRegulationVerified(
  regulationId: string,
  regulationName: string,
  changed: boolean,
  notes?: string
): Promise<{ error?: string }> {
  const user    = await requireRole('analyst')
  const supabase = await createClient()

  const { error: logError } = await supabase
    .from('compliance_verification_log')
    .insert({
      regulation_id: regulationId,
      org_id:        user.orgId,
      verified_by:   user.id,
      changed,
      notes:         notes ?? null,
    })
  if (logError) return { error: logError.message }

  await supabase
    .from('compliance_regulations')
    .update({ last_verified_at: new Date().toISOString() })
    .eq('id', regulationId)

  // fire-and-forget — audit failures must never block mutations
  void logAuditEvent({
    action:      'compliance.regulation_verified',
    entity_type: 'compliance_regulation',
    entity_id:   regulationId,
    entity_name: regulationName,
    details:     { changed, notes },
    user_id:     user.id,
    user_email:  user.email || undefined,
    org_id:      user.orgId,
  })

  return {}
}
