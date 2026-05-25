'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'

export async function upsertControlMatrixCell(
  dataType: string,
  categoryId: string,
  actionCode: string,
): Promise<{ error?: string }> {
  const user = await requireRole('analyst')
  const supabase = await createClient()

  const { error } = await supabase
    .from('org_control_matrix_overrides')
    .upsert(
      {
        org_id: user.orgId,
        data_type: dataType,
        category_id: categoryId,
        action_code: actionCode,
        updated_at: new Date().toISOString(),
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
