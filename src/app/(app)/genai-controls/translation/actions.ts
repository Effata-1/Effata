'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { callData } from '@/lib/api-client.server'

export async function triggerTranslation(): Promise<{ jobId: string } | { error: string }> {
  try {
    await requireRole('analyst')
    const result = await callData<{ jobId: string }>('/api/jobs', {
      method: 'POST',
      body:   { jobType: 'policy-translate', payload: {} },
    })
    return { jobId: result.jobId }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to trigger translation job' }
  }
}

export async function getTranslationJobStatus(jobId: string): Promise<{
  status:         string
  processedItems: number | null
  totalItems:     number | null
  error:          string | null
}> {
  try {
    await requireRole('analyst')
    const data = await callData<{
      status:          string
      processed_items: number | null
      total_items:     number | null
      error:           string | null
    }>(`/api/jobs/${jobId}`)
    return {
      status:         data.status,
      processedItems: data.processed_items,
      totalItems:     data.total_items,
      error:          data.error,
    }
  } catch (err) {
    return {
      status:         'error',
      processedItems: null,
      totalItems:     null,
      error:          err instanceof Error ? err.message : 'Failed to fetch job status',
    }
  }
}

export async function retranslatePolicy(policyId: string): Promise<{ jobId: string } | { error: string }> {
  try {
    await requireRole('analyst')
    const result = await callData<{ jobId: string }>('/api/jobs', {
      method: 'POST',
      body:   { jobType: 'policy-translate', payload: { policy_ids: [policyId] } },
    })
    // Do NOT revalidatePath here — job hasn't finished yet, nothing has changed.
    // window.location.reload() in the polling handler reloads once the job completes.
    return { jobId: result.jobId }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to trigger re-translation' }
  }
}

export async function markTranslationVerified(translationId: string): Promise<{ error?: string }> {
  const user     = await requireRole('analyst')
  const supabase = await createClient()

  const { error } = await supabase
    .from('org_vendor_translations')
    .update({
      status:      'verified',
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      updated_at:  new Date().toISOString(),
    })
    .eq('id', translationId)
    .eq('org_id', user.orgId)

  if (error) return { error: error.message }
  revalidatePath('/genai-controls/translation')
  revalidatePath('/genai-controls/translation/[policyId]', 'layout')
  return {}
}

export async function markTranslationDeferred(translationId: string): Promise<{ error?: string }> {
  const user     = await requireRole('analyst')
  const supabase = await createClient()

  const { error } = await supabase
    .from('org_vendor_translations')
    .update({
      status:     'deferred',
      updated_at: new Date().toISOString(),
    })
    .eq('id', translationId)
    .eq('org_id', user.orgId)

  if (error) return { error: error.message }
  revalidatePath('/genai-controls/translation')
  revalidatePath('/genai-controls/translation/[policyId]', 'layout')
  return {}
}
