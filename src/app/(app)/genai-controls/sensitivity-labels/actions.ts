'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'

export interface CustomerLabelFields {
  display_name: string
  label_key:    string
  label_value:  string
  label_source: string
  color:        string
  system_level: string | null
  priority:     number
}

export async function upsertCustomerLabel(
  id: string | null,
  fields: CustomerLabelFields,
): Promise<{ error?: string }> {
  const user     = await requireRole('analyst')
  const supabase = await createClient()

  const payload = {
    org_id:       user.orgId,
    display_name: fields.display_name.trim(),
    label_key:    fields.label_key.trim(),
    label_value:  fields.label_value.trim() || 'True',
    label_source: fields.label_source,
    color:        fields.color,
    system_level: fields.system_level || null,
    priority:     fields.priority,
    active:       true,
    updated_at:   new Date().toISOString(),
  }

  if (id) {
    const { error } = await supabase
      .from('org_customer_sensitivity_labels')
      .update(payload)
      .eq('id', id)
      .eq('org_id', user.orgId)
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase
      .from('org_customer_sensitivity_labels')
      .insert(payload)
    if (error) return { error: error.message }
  }

  revalidatePath('/genai-controls/sensitivity-labels')
  revalidatePath('/genai-controls/control-matrix')
  return {}
}

// Soft-delete only — sets active=false. Preserves control matrix override
// references that use this label's id as part of the rowKey.
export async function deactivateCustomerLabel(id: string): Promise<{ error?: string }> {
  const user     = await requireRole('analyst')
  const supabase = await createClient()

  const { error } = await supabase
    .from('org_customer_sensitivity_labels')
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('org_id', user.orgId)

  if (error) return { error: error.message }

  revalidatePath('/genai-controls/sensitivity-labels')
  revalidatePath('/genai-controls/control-matrix')
  return {}
}
