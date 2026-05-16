'use server'

import { createClient } from '@/lib/supabase/server'
import type { CustomerClass } from '@/lib/genai/types'

export async function setCustomerClassification(
  appId: string,
  orgId: string,
  classification: CustomerClass
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
  return {}
}
