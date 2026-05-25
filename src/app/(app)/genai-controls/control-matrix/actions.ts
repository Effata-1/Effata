'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { upsertLabel, deleteLabel } from '@/lib/data-catalog/actions'

export async function upsertControlMatrixCell(
  dataType: string,
  categoryId: string,
  actionCode: string,
  coachingNotificationId: string | null = null,
): Promise<{ error?: string }> {
  const user = await requireRole('analyst')
  const supabase = await createClient()

  const { error } = await supabase
    .from('org_control_matrix_overrides')
    .upsert(
      {
        org_id:                    user.orgId,
        data_type:                 dataType,
        category_id:               categoryId,
        action_code:               actionCode,
        coaching_notification_id:  coachingNotificationId,
        updated_at:                new Date().toISOString(),
      },
      { onConflict: 'org_id,data_type,category_id' },
    )

  if (error) return { error: error.message }
  revalidatePath('/genai-controls/control-matrix')
  return {}
}

export async function deleteControlMatrixCell(
  dataType: string,
  categoryId: string,
): Promise<{ error?: string }> {
  const user = await requireRole('analyst')
  const supabase = await createClient()

  const { error } = await supabase
    .from('org_control_matrix_overrides')
    .delete()
    .eq('org_id', user.orgId)
    .eq('data_type', dataType)
    .eq('category_id', categoryId)

  if (error) return { error: error.message }
  revalidatePath('/genai-controls/control-matrix')
  return {}
}

// ── Classification label management (also revalidates control matrix) ─────────

export async function upsertMatrixLabel(
  labelId: string | null,
  fields: { name: string; color: string; description: string; priority: number },
): Promise<{ error?: string }> {
  const result = await upsertLabel(labelId, fields)
  revalidatePath('/genai-controls/control-matrix')
  return result
}

export async function deleteMatrixLabel(labelId: string): Promise<{ error?: string }> {
  const result = await deleteLabel(labelId)
  revalidatePath('/genai-controls/control-matrix')
  return result
}
