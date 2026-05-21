'use server'

import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { CoverageStatus } from '@/lib/channel-taxonomy'

export async function updateMyStack(
  tools: string[],
  modules: Record<string, string[]>,
  coverageAreas: Record<string, string>,
) {
  const user = await requireRole('analyst')
  const supabase = await createClient()

  const { error } = await supabase
    .from('onboarding_profiles')
    .update({
      tools,
      modules,
      coverage_areas: coverageAreas,
      updated_at: new Date().toISOString(),
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
  revalidatePath(`/channels/${channelSlug}`)
}

export async function requestCoverageReview() {
  const user = await requireRole('analyst')
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!

  const res = await fetch(`${supabaseUrl}/functions/v1/review-dlp-coverage`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ orgId: user.orgId }),
  })

  if (!res.ok) throw new Error('Coverage review request failed')
  revalidatePath('/dlp-tools/my-stack')
}
