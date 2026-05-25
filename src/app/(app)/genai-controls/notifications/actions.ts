'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import type { CoachingTone } from '@/lib/genai/types'

export interface NotificationFields {
  name?:             string
  coach_label?:      string | null
  action_code?:      'coach' | 'coach-ack' | 'coach-just'
  title?:            string
  message?:          string
  tone?:             CoachingTone
  linked_policy_id?: string | null
  is_default?:       boolean
  is_active?:        boolean
}

export async function upsertNotification(
  id: string | null,
  fields: NotificationFields,
): Promise<{ error?: string }> {
  const user = await requireRole('analyst')
  const supabase = await createClient()

  const payload = {
    org_id:     user.orgId,
    updated_at: new Date().toISOString(),
    ...fields,
    ...(id ? { id } : {}),
  }

  const { error } = id
    ? await supabase.from('org_coaching_notifications').upsert(payload, { onConflict: 'id' })
    : await supabase.from('org_coaching_notifications').insert(payload)

  if (error) return { error: error.message }
  revalidatePath('/genai-controls/notifications')
  return {}
}

export async function deleteNotification(id: string): Promise<{ error?: string }> {
  const user = await requireRole('analyst')
  const supabase = await createClient()

  const { error } = await supabase
    .from('org_coaching_notifications')
    .delete()
    .eq('id', id)
    .eq('org_id', user.orgId)

  if (error) return { error: error.message }
  revalidatePath('/genai-controls/notifications')
  return {}
}

export async function toggleNotificationActive(
  id: string,
  is_active: boolean,
): Promise<{ error?: string }> {
  const user = await requireRole('analyst')
  const supabase = await createClient()

  const { error } = await supabase
    .from('org_coaching_notifications')
    .update({ is_active, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('org_id', user.orgId)

  if (error) return { error: error.message }
  revalidatePath('/genai-controls/notifications')
  return {}
}
