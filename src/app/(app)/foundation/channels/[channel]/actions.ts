'use server'

import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { logAuditEvent } from '@/lib/audit'
import type { CoverageStatus } from '@/lib/channel-taxonomy'

export async function saveAssessmentAnswers(
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

  await logAuditEvent({
    action:      'channel.assessment_saved',
    entity_type: 'channel_coverage',
    entity_name: channelSlug,
    details:     { answer_count: Object.keys(answers).length },
    org_id:  user.orgId,
    user_id: user.id,
  })
  revalidatePath(`/foundation/channels/${channelSlug}`)
}
