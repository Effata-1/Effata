'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { logAuditEvent } from '@/lib/audit'

export interface PresentationSnapshot {
  org_name:       string
  industry:       string
  coverage_score: number | null
  app_counts: {
    enterprise_approved:        number
    approved_with_conditions:   number
    permitted_with_restriction: number
    prohibited:                 number
    total:                      number
  }
  policies: Array<{
    name:                     string
    description:              string | null
    policy_type:              string
    primary_action:           string | null
    data_classification_label: string | null
    approval_status:          string
  }>
  generated_at: string
}

export async function generatePresentation(): Promise<{ id?: string; token?: string; error?: string }> {
  const user    = await requireRole('analyst')
  const supabase = await createClient()

  const [orgResult, profileResult, classificationsResult, policiesResult, coverageResult] =
    await Promise.all([
      supabase.from('organisations').select('name').eq('id', user.orgId).maybeSingle(),
      supabase.from('onboarding_profiles').select('industry').eq('org_id', user.orgId).maybeSingle(),
      supabase
        .from('genai_customer_classifications')
        .select('customer_classification')
        .eq('org_id', user.orgId)
        .neq('customer_classification', 'unknown'),
      supabase
        .from('org_genai_policies')
        .select('name, description, policy_type, primary_action, data_classification_label, approval_status')
        .eq('org_id', user.orgId)
        .order('priority'),
      supabase
        .from('dlp_coverage_ai_reviews')
        .select('coverage_score')
        .eq('org_id', user.orgId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

  const classifications = classificationsResult.data ?? []
  const countBy = (cls: string) => classifications.filter(c => c.customer_classification === cls).length

  const snapshot: PresentationSnapshot = {
    org_name:       (orgResult.data?.name ?? 'Your Organisation') as string,
    industry:       (profileResult.data?.industry as string | null) ?? 'Not specified',
    coverage_score: (coverageResult.data?.coverage_score as number | null) ?? null,
    app_counts: {
      enterprise_approved:        countBy('enterprise-approved'),
      approved_with_conditions:   countBy('approved-with-conditions'),
      permitted_with_restriction: countBy('permitted-with-restriction'),
      prohibited:                 countBy('prohibited'),
      total:                      classifications.length,
    },
    policies: (policiesResult.data ?? []).map(p => ({
      name:                     p.name as string,
      description:              p.description as string | null,
      policy_type:              p.policy_type as string,
      primary_action:           p.primary_action as string | null,
      data_classification_label: p.data_classification_label as string | null,
      approval_status:          p.approval_status as string,
    })),
    generated_at: new Date().toISOString(),
  }

  const { data: inserted, error } = await supabase
    .from('genai_presentations')
    .insert({
      org_id:    user.orgId,
      user_id:   user.id,
      title:     'GenAI DLP Policy Pack',
      snapshot,
      is_public: true,
    })
    .select('id, public_token')
    .single()

  if (error) return { error: error.message }

  void logAuditEvent({
    action:      'presentation.shared',
    entity_type: 'genai_presentations',
    details:     { token: inserted.public_token },
    org_id:      user.orgId,
    user_id:     user.id,
  })

  revalidatePath('/genai-controls/presentation')
  revalidatePath('/genai-controls')
  return { id: inserted.id as string, token: inserted.public_token as string }
}

export async function revokePresentation(id: string): Promise<{ error?: string }> {
  const user    = await requireRole('analyst')
  const supabase = await createClient()

  const { error } = await supabase
    .from('genai_presentations')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)
    .eq('org_id', user.orgId)

  if (error) return { error: error.message }

  void logAuditEvent({
    action:      'presentation.revoked',
    entity_type: 'genai_presentations',
    entity_id:   id,
    org_id:      user.orgId,
    user_id:     user.id,
  })

  revalidatePath('/genai-controls/presentation')
  return {}
}

export async function getLatestPresentation(): Promise<{
  id:           string
  public_token: string
  revoked_at:   string | null
  created_at:   string
} | null> {
  const user    = await requireRole('analyst')
  const supabase = await createClient()

  const { data } = await supabase
    .from('genai_presentations')
    .select('id, public_token, revoked_at, created_at')
    .eq('org_id', user.orgId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data) return null
  return {
    id:           data.id as string,
    public_token: data.public_token as string,
    revoked_at:   data.revoked_at as string | null,
    created_at:   data.created_at as string,
  }
}
