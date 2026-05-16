import 'server-only'
import { createClient } from '@/lib/supabase/server'

export interface AuditEventParams {
  action: string
  entity_type?: string
  entity_id?: string
  entity_name?: string
  old_value?: string
  new_value?: string
  details?: Record<string, unknown>
  // Provide these when the caller already has them to avoid an extra getSession call
  user_id?: string
  user_email?: string
  org_id?: string
}

export async function logAuditEvent(params: AuditEventParams): Promise<void> {
  try {
    const supabase = await createClient()

    let { user_id, user_email, org_id } = params

    if (!org_id || !user_id) {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return // No session — skip silently

      org_id  = org_id  ?? (JSON.parse(atob(session.access_token.split('.')[1]))?.org_id ?? null)
      user_id = user_id ?? session.user.id
      user_email = user_email ?? session.user.email ?? undefined
    }

    if (!org_id) return // RLS requires org_id — skip silently

    await supabase.from('audit_logs').insert({
      org_id,
      user_id,
      user_email:  user_email  ?? null,
      action:      params.action,
      entity_type: params.entity_type ?? null,
      entity_id:   params.entity_id   ?? null,
      entity_name: params.entity_name ?? null,
      old_value:   params.old_value   ?? null,
      new_value:   params.new_value   ?? null,
      details:     params.details     ?? {},
    })
  } catch {
    // Never throw — audit must never break the main operation
  }
}
