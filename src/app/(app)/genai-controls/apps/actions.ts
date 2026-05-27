'use server'

import { requireRole } from '@/lib/auth'
import { callData } from '@/lib/api-client.server'

export interface EvaluatedAppCard {
  app_id:                  string
  app_name:                string
  vendor:                  string
  app_type:                string
  logo_letter:             string
  logo_bg:                 string
  trustScore:              number
  dlpActivitiesSupported:  number
  dlpActivitiesTotal:      number
  suggestedClassification: string
  isNewToDb:               boolean
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
    const msg = err instanceof Error ? err.message : String(err)
    return { error: `Evaluation failed: ${msg}` }
  }
}
