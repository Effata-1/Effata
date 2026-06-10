'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import type { ControlType, CoachingTone } from '@/lib/genai/types'
import { SEED_DEFAULTS, SEED_BY_KEY } from './_data/seeds'

// Idempotent seed of all default coaching templates for an org.
// Called at the start of syncRecommendedPolicies so templates are always available
// without requiring a visit to the notifications page first.
export async function ensureDefaultCoachingTemplates(orgId: string): Promise<void> {
  try {
    const supabase = await createClient()

    const { data: existing } = await supabase
      .from('org_coaching_notifications')
      .select('template_key')
      .eq('org_id', orgId)
      .not('template_key', 'is', null)

    const existingKeys = new Set((existing ?? []).map((r: { template_key: string | null }) => r.template_key))
    const missing = SEED_DEFAULTS.filter(t => !existingKeys.has(t.template_key))
    if (missing.length === 0) return

    const rows = missing.map(t => ({
      org_id:              orgId,
      template_key:        t.template_key,
      name:                t.name,
      description:         t.description,
      control_type:        t.control_type,
      title:               t.title,
      subtitle:            t.subtitle,
      message:             t.message,
      show_exception_line: t.show_exception_line,
      show_details:        t.show_details,
      recommended_for:     t.recommended_for,
      tokens_used:         extractTokens(t.title, t.subtitle, t.message),
      action_code:         t.action_code,
      tone:                t.tone,
      is_default:          true,
      is_active:           true,
      updated_at:          new Date().toISOString(),
    }))

    await supabase.from('org_coaching_notifications').insert(rows)
  } catch {
    // Table may not exist yet (migration pending) — fail silently
  }
}

export interface NotificationFields {
  name?:                string
  description?:         string | null
  coach_label?:         string | null
  template_key?:        string | null
  action_code?:         'coach' | 'coach-ack' | 'coach-just'
  control_type?:        ControlType
  title?:               string
  subtitle?:            string | null
  message?:             string
  show_exception_line?: boolean
  show_details?:        boolean
  recommended_for?:     string[]
  tone?:                CoachingTone
  linked_policy_id?:    string | null
  is_default?:          boolean
  is_active?:           boolean
}

function extractTokens(...inputs: (string | null | undefined)[]): string[] {
  const combined = inputs.filter(Boolean).join(' ')
  const matches = combined.match(/\{\{[A-Z_]+\}\}/g) ?? []
  return Array.from(new Set(matches))
}

function controlTypeToActionCode(ct: ControlType): 'coach' | 'coach-ack' | 'coach-just' {
  if (ct === 'coach_acknowledge')   return 'coach-ack'
  if (ct === 'coach_justification') return 'coach-just'
  return 'coach'
}

function controlTypeToTone(ct: ControlType): CoachingTone {
  if (ct === 'block')                                              return 'urgent'
  if (ct === 'coach_acknowledge' || ct === 'coach_justification') return 'warning'
  return 'informational'
}

export async function upsertNotification(
  id: string | null,
  fields: NotificationFields,
): Promise<{ error?: string }> {
  const user = await requireRole('analyst')
  const supabase = await createClient()

  const tokens_used = extractTokens(fields.title, fields.subtitle, fields.message)

  // Derive legacy action_code + tone from control_type when provided
  const derived = fields.control_type
    ? {
        action_code: fields.action_code ?? controlTypeToActionCode(fields.control_type),
        tone:        fields.tone        ?? controlTypeToTone(fields.control_type),
      }
    : {}

  const payload = {
    org_id:     user.orgId,
    updated_at: new Date().toISOString(),
    ...fields,
    ...derived,
    tokens_used,
    ...(id ? { id } : {}),
  }

  const { error } = id
    ? await supabase.from('org_coaching_notifications').upsert(payload, { onConflict: 'id' })
    : await supabase.from('org_coaching_notifications').insert(payload)

  if (error) return { error: error.message }
  revalidatePath('/genai-controls/coaching-messages')
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
  revalidatePath('/genai-controls/coaching-messages')
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
  revalidatePath('/genai-controls/coaching-messages')
  return {}
}

export async function resetNotification(id: string): Promise<{ error?: string }> {
  const user = await requireRole('analyst')
  const supabase = await createClient()

  const { data, error: fetchErr } = await supabase
    .from('org_coaching_notifications')
    .select('template_key')
    .eq('id', id)
    .eq('org_id', user.orgId)
    .single()

  if (fetchErr || !data) return { error: fetchErr?.message ?? 'Not found' }

  const seed = data.template_key ? SEED_BY_KEY.get(data.template_key) : null
  if (!seed) return { error: 'No seed data found for this template' }

  const tokens_used = extractTokens(seed.title, seed.subtitle, seed.message)
  const { error } = await supabase
    .from('org_coaching_notifications')
    .update({
      name:                seed.name,
      description:         seed.description,
      control_type:        seed.control_type,
      title:               seed.title,
      subtitle:            seed.subtitle,
      message:             seed.message,
      show_exception_line: seed.show_exception_line,
      show_details:        seed.show_details,
      recommended_for:     seed.recommended_for,
      action_code:         seed.action_code,
      tone:                seed.tone,
      tokens_used,
      updated_at:          new Date().toISOString(),
    })
    .eq('id', id)
    .eq('org_id', user.orgId)

  if (error) return { error: error.message }
  revalidatePath('/genai-controls/coaching-messages')
  return {}
}

export async function duplicateNotification(id: string): Promise<{ error?: string }> {
  const user = await requireRole('analyst')
  const supabase = await createClient()

  const { data, error: fetchErr } = await supabase
    .from('org_coaching_notifications')
    .select('*')
    .eq('id', id)
    .eq('org_id', user.orgId)
    .single()

  if (fetchErr || !data) return { error: fetchErr?.message ?? 'Not found' }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _id, created_at: _ca, updated_at: _ua, template_key: _tk, ...rest } = data

  const { error } = await supabase
    .from('org_coaching_notifications')
    .insert({
      ...rest,
      org_id:       user.orgId,
      name:         `${rest.name} (copy)`,
      template_key: null,
      is_default:   false,
      updated_at:   new Date().toISOString(),
    })

  if (error) return { error: error.message }
  revalidatePath('/genai-controls/coaching-messages')
  return {}
}
