'use server'

import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { callData } from '@/lib/api-client.server'
import { revalidatePath } from 'next/cache'
import type { CoverageStatus } from '@/lib/channel-taxonomy'

export interface LicenceDetail {
  seats?:     number
  cycle?:     'monthly' | 'annual' | '2-year' | '3-year'
  startDate?: string
  endDate?:   string
  notes?:     string
}

export async function updateMyStack(
  tools: string[],
  modules: Record<string, string[]>,
  coverageAreas: Record<string, string>,
  licenceDetails: Record<string, LicenceDetail>,
) {
  const user = await requireRole('analyst')
  const supabase = await createClient()

  const { error } = await supabase
    .from('onboarding_profiles')
    .update({
      tools,
      modules,
      coverage_areas:  coverageAreas,
      licence_details: licenceDetails,
      updated_at:      new Date().toISOString(),
    })
    .eq('user_id', user.id)

  if (error) throw new Error(error.message)

  revalidatePath('/dlp-tools/my-stack')
  revalidatePath('/dlp-tools/market')
}

export async function saveChannelAssessment(
  channelSlug: string,
  answers: Record<string, CoverageStatus>,
) {
  const user = await requireRole('analyst')
  const supabase = await createClient()

  const { error } = await supabase
    .from('channel_coverage')
    .upsert(
      {
        org_id:             user.orgId,
        channel_slug:       channelSlug,
        assessment_answers: answers,
        last_updated_by:    user.id,
        updated_at:         new Date().toISOString(),
      },
      { onConflict: 'org_id,channel_slug' },
    )

  if (error) throw new Error(error.message)

  revalidatePath('/dlp-tools/my-stack')
  revalidatePath(`/foundation/channels/${channelSlug}`)
}

export async function requestCoverageReview(): Promise<{ jobId: string }> {
  await requireRole('analyst')
  const result = await callData<{ jobId: string }>('/api/data/coverage-review', { method: 'POST' })
  return { jobId: result.jobId }
}

export async function getJobStatus(jobId: string): Promise<{ status: string }> {
  await requireRole('analyst')
  const data = await callData<{ status: string }>(`/api/jobs/${jobId}`)
  return { status: data.status }
}
