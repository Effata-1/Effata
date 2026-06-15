'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { upsertLabel, deleteLabel } from '@/lib/data-catalog/actions'
import { syncRecommendedPolicies } from '@/app/(app)/genai-controls/policies/actions'
import { logAuditEvent } from '@/lib/audit'
import { validateActionTemplate } from '@/lib/genai/coaching-validation'
import type { ControlType } from '@/lib/genai/types'

export async function upsertControlMatrixCell(
  dataType: string,
  categoryId: string,
  actionCode: string,
  coachingNotificationId: string | null = null,
): Promise<{ error?: string; warning?: string }> {
  const user = await requireRole('analyst')
  const supabase = await createClient()

  // Pass 1: validate null template — rejects block/coach-ack/coach-just with no template
  if (!coachingNotificationId) {
    const check = validateActionTemplate(actionCode, null)
    if (!check.valid) return { error: check.reason }
  }

  // Pass 2: validate template compatibility when one is provided
  if (coachingNotificationId) {
    const { data: tpl } = await supabase
      .from('org_coaching_notifications')
      .select('control_type')
      .eq('id', coachingNotificationId)
      .eq('org_id', user.orgId)
      .maybeSingle()
    if (!tpl) return { error: 'Coaching template not found or does not belong to this organisation.' }
    const check = validateActionTemplate(actionCode, tpl.control_type as ControlType)
    if (!check.valid) return { error: check.reason }
  }

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
  await logAuditEvent({
    action:      'control_matrix.cell_updated',
    entity_type: 'org_control_matrix_overrides',
    entity_name: `${dataType} / ${categoryId}`,
    new_value:   actionCode,
    details:     { data_type: dataType, category_id: categoryId, coaching_notification_id: coachingNotificationId },
    org_id:  user.orgId,
    user_id: user.id,
    user_email:  user.email,
  })
  revalidatePath('/genai-controls/control-matrix')

  // Keep recommended policies live-updated when matrix changes
  try {
    await syncRecommendedPolicies()
  } catch (e) {
    console.error('[control-matrix] sync error:', e)
    // Matrix cell was saved — only the downstream policy sync failed
    return { warning: 'Matrix was saved, but recommended policy sync failed. Policies may be out of date.' }
  }

  return {}
}

export async function deleteControlMatrixCell(
  dataType: string,
  categoryId: string,
): Promise<{ error?: string; warning?: string }> {
  const user = await requireRole('analyst')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('org_control_matrix_overrides')
    .delete()
    .eq('org_id', user.orgId)
    .eq('data_type', dataType)
    .eq('category_id', categoryId)
    .select('id')
    .maybeSingle()

  if (error) return { error: error.message }
  // No override existed — cell is already at default. No-op, no audit.
  if (!data) return {}
  await logAuditEvent({
    action:      'control_matrix.cell_reset',
    entity_type: 'org_control_matrix_overrides',
    entity_name: `${dataType} / ${categoryId}`,
    details:     { data_type: dataType, category_id: categoryId },
    org_id:  user.orgId,
    user_id: user.id,
    user_email:  user.email,
  })

  let warning: string | undefined
  try {
    await syncRecommendedPolicies()
  } catch (syncErr) {
    console.error('[control-matrix] sync error after delete:', syncErr)
    warning = 'Cell reset but recommended policies may be stale — they will refresh on next page load.'
  }

  revalidatePath('/genai-controls/control-matrix')
  revalidatePath('/genai-controls/policies')

  return warning ? { warning } : {}
}

export async function updateCategoryAccessPosture(
  categoryId: string,
  accessPosture: 'allow' | 'allow_dlp' | 'block',
): Promise<{ error?: string; warning?: string }> {
  const user = await requireRole('analyst')
  const supabase = await createClient()

  // Prohibited categories are locked to 'block' — neq guard silently blocks them.
  const { data, error } = await supabase
    .from('org_genai_governance_categories')
    .update({ access_posture: accessPosture })
    .eq('org_id', user.orgId)
    .eq('id', categoryId)
    .neq('system_tag', 'prohibited')
    .select('id')
    .maybeSingle()

  if (error) return { error: error.message }
  if (!data) return { error: 'Category not found or cannot be modified.' }
  await logAuditEvent({
    action:      'control_matrix.posture_updated',
    entity_type: 'org_genai_governance_categories',
    entity_id:   categoryId,
    new_value:   accessPosture,
    org_id:  user.orgId,
    user_id: user.id,
    user_email:  user.email,
  })
  revalidatePath('/genai-controls/control-matrix')

  // Changing posture may add or remove app-block policies
  try {
    await syncRecommendedPolicies()
  } catch (e) {
    console.error('[control-matrix] posture sync error:', e)
    return { warning: 'Posture was saved, but recommended policy sync failed. Policies may be out of date.' }
  }

  return {}
}

// ── Reset all overrides to system defaults ─────────────────────────────────────
// Deletes every row in org_control_matrix_overrides for this org, then re-syncs
// recommended policies so matrix_basis reflects the clean state.

export async function resetMatrixToDefaults(): Promise<{ error?: string }> {
  const user = await requireRole('admin')
  const supabase = await createClient()

  const { error } = await supabase
    .from('org_control_matrix_overrides')
    .delete()
    .eq('org_id', user.orgId)

  if (error) return { error: error.message }
  await logAuditEvent({
    action:      'control_matrix.reset',
    entity_type: 'org_control_matrix_overrides',
    org_id:  user.orgId,
    user_id: user.id,
    user_email:  user.email,
  })

  try { await syncRecommendedPolicies() } catch (e) { console.error('[control-matrix] reset sync error:', e) }
  revalidatePath('/genai-controls/control-matrix')
  revalidatePath('/genai-controls/policies')
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
