'use server'

import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

export async function createBlankPolicy(
  name: string,
  description?: string,
): Promise<{ id?: string; error?: string }> {
  const user     = await requireRole('analyst')
  const supabase = await createClient()

  const now = new Date().toISOString()

  const blankNpj = {
    schema_version: '1.0',
    intent:         'prevent_exfiltration',
    policy_id:      `manual:blank:${Date.now()}`,
    policy_name:    name,
    scope: {
      users:          ['All Users'],
      activities:     [],
      app_categories: [],
    },
    content:  { operator: 'any', conditions: [] },
    decision: { mode: 'allow' },
    provenance: {
      generated_at:     now,
      compiler_version: '1.0',
      source:           'manual',
    },
  }

  const { data, error } = await supabase
    .from('org_genai_policies')
    .insert({
      org_id:                    user.orgId,
      name,
      description:               description ?? null,
      is_active:                 false,
      approval_status:           'draft',
      vendor_translation_status: 'pending',
      generated_from:            'manual',
      policy_source:             'manual',
      neutral_policy_json:       blankNpj,
      updated_at:                now,
      scope_app_ids:             [],
      scope_all_apps:            true,
    })
    .select('id')
    .maybeSingle()

  if (error) return { error: error.message }
  revalidatePath('/genai-controls/policies')
  return { id: (data as { id: string } | null)?.id }
}
