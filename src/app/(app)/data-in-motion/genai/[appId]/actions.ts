'use server'

import { createClient } from '@/lib/supabase/server'
import type { CustomerClass } from '@/lib/genai/types'

export async function setCustomerClassification(
  appId: string,
  orgId: string,
  classification: CustomerClass,
  previous: CustomerClass
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('genai_customer_classifications')
    .upsert({
      org_id: orgId,
      app_id: appId,
      customer_classification: classification,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'org_id,app_id' })

  if (error) return { error: error.message }

  // Fetch app name for the audit record
  const { data: app } = await supabase
    .from('genai_apps')
    .select('app_name')
    .eq('app_id', appId)
    .single()

  // Write audit log — non-blocking, ignore errors
  await supabase.from('audit_logs').insert({
    org_id:      orgId,
    user_id:     user.id,
    user_email:  user.email ?? null,
    action:      'classification_changed',
    entity_type: 'genai_app',
    entity_id:   appId,
    entity_name: app?.app_name ?? appId,
    old_value:   previous,
    new_value:   classification,
  }).then(() => {})

  return {}
}
