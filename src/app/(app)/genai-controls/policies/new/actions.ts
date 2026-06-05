'use server'

import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { TAG_ALIAS } from '@/lib/genai/control-matrix-rows'
import { enrichManualNpj } from '@/lib/genai/npj-enrich'

export async function createBlankPolicy(
  name: string,
  description?: string,
): Promise<{ id?: string; error?: string }> {
  const user     = await requireRole('analyst')
  const supabase = await createClient()

  const now = new Date().toISOString()

  // Fetch org categories to build actions_by_category (same structure as recommended policies)
  const { data: catRows } = await supabase
    .from('org_genai_governance_categories')
    .select('id, system_tag, access_posture')
    .eq('org_id', user.orgId)
    .eq('active', true)
    .order('priority')

  const actions_by_category: Record<string, string> = {}
  for (const cat of catRows ?? []) {
    if ((cat as Record<string, unknown>).access_posture === 'block') continue
    const tag = TAG_ALIAS[cat.system_tag as string ?? ''] ?? cat.system_tag as string ?? ''
    if (!tag) continue
    actions_by_category[tag] = 'allow'
  }

  // Build the base policy, then run it through the shared enrichment helper so a
  // manual policy carries the same structural fields (channels, decision severity,
  // telemetry, exceptions, standardised provenance) as recommended + AI policies.
  const blankNpj = enrichManualNpj({
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
    actions_by_category,
    coaching_by_category: Object.fromEntries(Object.keys(actions_by_category).map(k => [k, null])),
    provenance: { generated_at: now },
  })

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
