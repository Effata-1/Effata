'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { callData } from '@/lib/api-client.server'
import type { CustomerClass } from '@/lib/genai/types'

export interface EvaluatedAppCard {
  app_id:                  string
  app_name:                string
  vendor:                  string
  domain:                  string
  app_type:                string
  logo_letter:             string
  logo_bg:                 string
  trustScore:              number
  dlpActivitiesSupported:  number
  dlpActivitiesTotal:      number
  suggestedClassification: string
  isNewToDb:               boolean
}

export async function bulkSetClassification(
  appIds: string[],
  classification: CustomerClass,
): Promise<{ count: number; error?: string }> {
  if (appIds.length === 0) return { count: 0 }
  const user = await requireRole('analyst')
  const supabase = await createClient()

  const rows = appIds.map(app_id => ({
    org_id: user.orgId,
    app_id,
    customer_classification: classification,
    updated_at: new Date().toISOString(),
  }))

  const { error } = await supabase
    .from('genai_customer_classifications')
    .upsert(rows, { onConflict: 'org_id,app_id' })

  if (error) return { count: 0, error: error.message }
  revalidatePath('/genai-controls/apps')
  return { count: appIds.length }
}

export async function evaluateApp(
  searchTerm: string,
): Promise<{ data?: EvaluatedAppCard; error?: string }> {
  try {
    await requireRole('analyst')

    const response = await callData<{ data: EvaluatedAppCard | null }>(
      '/api/data/genai-apps/evaluate',
      { method: 'POST', body: { searchTerm } },
    )

    if (!response.data) {
      return { error: `"${searchTerm}" doesn't appear to be a known GenAI application.` }
    }

    return { data: response.data }
  } catch (err) {
    let msg = err instanceof Error ? err.message : String(err)
    // Backend returns JSON errors: {"error":"..."} — unwrap to get the real message
    try {
      const parsed = JSON.parse(msg) as Record<string, unknown>
      if (typeof parsed.error === 'string') msg = parsed.error
    } catch {}
    return { error: msg }
  }
}
