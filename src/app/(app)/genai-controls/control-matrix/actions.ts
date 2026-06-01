'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { upsertLabel, deleteLabel } from '@/lib/data-catalog/actions'
import { syncRecommendedPolicies } from '@/app/(app)/genai-controls/policies/actions'

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

  // Keep recommended policies live-updated when matrix changes
  try { await syncRecommendedPolicies() } catch (e) { console.error('[control-matrix] sync error:', e) }

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

export async function updateCategoryAccessPosture(
  categoryId: string,
  accessPosture: 'allow' | 'allow_dlp' | 'block',
): Promise<{ error?: string }> {
  const user = await requireRole('analyst')
  const supabase = await createClient()

  // Prohibited categories are locked to 'block' — never allow overriding them.
  const { error } = await supabase
    .from('org_genai_governance_categories')
    .update({ access_posture: accessPosture })
    .eq('org_id', user.orgId)
    .eq('id', categoryId)
    .neq('system_tag', 'prohibited')

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
