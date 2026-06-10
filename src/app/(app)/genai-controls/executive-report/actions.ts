'use server'

import { revalidatePath } from 'next/cache'
import { createClient }  from '@/lib/supabase/server'
import { requireRole }   from '@/lib/auth'
import { logAuditEvent } from '@/lib/audit'
import { lintAllPolicies } from '@/lib/genai/lint'
import type { GenAIPolicy }          from '@/lib/genai/types'
import type { PresentationSnapshot } from '@/lib/genai/presentation-types'

export type { PresentationSnapshot }

export async function generatePresentation(): Promise<{ id?: string; token?: string; error?: string }> {
  const user    = await requireRole('analyst')
  const supabase = await createClient()

  const [
    orgResult,
    profileResult,
    classificationsResult,
    policiesResult,
    coverageResult,
    categoriesResult,
    overridesResult,
    coachingResult,
  ] = await Promise.all([
    supabase.from('organisations').select('name').eq('id', user.orgId).maybeSingle(),
    supabase.from('onboarding_profiles').select('industry').eq('org_id', user.orgId).maybeSingle(),
    supabase
      .from('genai_customer_classifications')
      .select('customer_classification')
      .eq('org_id', user.orgId)
      .neq('customer_classification', 'unknown'),
    supabase
      .from('org_genai_policies')
      .select(
        'id, name, description, policy_type, primary_action, data_classification_label, ' +
        'approval_status, is_active, scope_all_apps, scope_app_ids, rules, policy_owner, ' +
        'next_review_date, neutral_policy_json, policy_source, policy_family, test_status, priority',
      )
      .eq('org_id', user.orgId)
      .order('priority'),
    supabase
      .from('dlp_coverage_ai_reviews')
      .select('coverage_score')
      .eq('org_id', user.orgId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('org_genai_governance_categories')
      .select('id, system_tag, name, color, access_posture')
      .eq('org_id', user.orgId)
      .eq('active', true)
      .order('priority'),
    supabase
      .from('org_control_matrix_overrides')
      .select('data_type, category_id, action_code, coaching_notification_id')
      .eq('org_id', user.orgId),
    supabase
      .from('org_coaching_notifications')
      .select('id, coach_label, control_type')
      .eq('org_id', user.orgId)
      .eq('is_active', true),
  ])

  const classifications = classificationsResult.data ?? []
  const rawPolicies     = ((policiesResult.data ?? []) as unknown[]) as GenAIPolicy[]
  const countBy = (cls: string) => classifications.filter(c => c.customer_classification === cls).length

  const lintIssues = lintAllPolicies(rawPolicies)
  const lintCount  = lintIssues.filter(i => i.severity === 'warning' || i.severity === 'error').length

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
    categories: ((categoriesResult.data ?? []) as unknown[]).map((c: unknown) => {
      const r = c as Record<string, unknown>
      return {
        id:             r.id             as string,
        system_tag:     r.system_tag     as string,
        name:           r.name           as string,
        color:          r.color          as string,
        access_posture: r.access_posture as string,
      }
    }),
    matrix_overrides: ((overridesResult.data ?? []) as unknown[]).map((o: unknown) => {
      const r = o as Record<string, unknown>
      return {
        data_type:                r.data_type                as string,
        category_id:              r.category_id              as string,
        action_code:              r.action_code              as string,
        coaching_notification_id: (r.coaching_notification_id as string | null) ?? null,
      }
    }),
    coaching_templates: ((coachingResult.data ?? []) as unknown[]).map((t: unknown) => {
      const r = t as Record<string, unknown>
      return {
        id:           r.id           as string,
        coach_label:  r.coach_label  as string,
        control_type: r.control_type as string,
      }
    }),
    policies: rawPolicies.map(p => ({
      id:                        p.id,
      name:                      p.name,
      description:               p.description,
      policy_type:               p.policy_type,
      primary_action:            p.primary_action,
      data_classification_label: p.data_classification_label,
      approval_status:           p.approval_status,
      is_active:                 p.is_active,
      policy_family:             p.policy_family,
      test_status:               p.test_status,
    })),
    lint_count:   lintCount,
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

  revalidatePath('/genai-controls/executive-report')
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

  revalidatePath('/genai-controls/executive-report')
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
    id:           data.id           as string,
    public_token: data.public_token as string,
    revoked_at:   data.revoked_at   as string | null,
    created_at:   data.created_at   as string,
  }
}
