import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { PolicyIntentEditor } from './_components/policy-intent-editor'
import { ensureClassificationLabels } from '@/lib/data-catalog/actions'

export default async function EditPolicyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user     = await requireRole('analyst')
  const supabase = await createClient()

  const [
    policyResult,
    appsResult,
    categoriesResult,
    classificationLabels,
    coachingTemplatesResult,
    allPoliciesResult,
    translationsResult,
    catalogTypesResult,
  ] = await Promise.all([
    supabase.from('org_genai_policies').select('*').eq('id', id).eq('org_id', user.orgId).single(),
    supabase.from('genai_apps').select('app_id, app_name, vendor, app_type, logo_letter, logo_bg').order('app_name'),
    supabase.from('org_genai_governance_categories').select('id, system_tag, name, color').eq('org_id', user.orgId).eq('active', true).order('priority'),
    ensureClassificationLabels().catch(() => []),
    supabase.from('org_coaching_notifications').select('id, name, coach_label').eq('org_id', user.orgId).order('name'),
    supabase.from('org_genai_policies').select('id, name').eq('org_id', user.orgId).order('priority'),
    supabase.from('org_vendor_translations').select('id, vendor_id, status, neutral_policy_hash').eq('policy_id', id).eq('org_id', user.orgId),
    supabase.from('catalog_data_types').select('id, name, risk_family').eq('active', true).order('priority').order('name'),
  ])

  if (!policyResult.data) notFound()

  const policy            = policyResult.data
  const apps              = appsResult.data              ?? []
  const categories        = categoriesResult.data        ?? []
  const coachingTemplates = coachingTemplatesResult.data ?? []
  const allPolicies       = allPoliciesResult.data       ?? []
  const translations      = translationsResult.data      ?? []
  const catalogDataTypes  = (catalogTypesResult.data ?? []) as Array<{ id: string; name: string; risk_family: string | null }>

  return (
    <PolicyIntentEditor
      policy={{
        id:                        policy.id,
        name:                      policy.name,
        description:               policy.description,
        is_active:                 policy.is_active,
        approval_status:           policy.approval_status,
        category_id:               policy.category_id,
        scope_app_ids:             policy.scope_app_ids ?? [],
        identity_context:          policy.identity_context,
        policy_family:             policy.policy_family ?? null,
        generated_from:            policy.generated_from ?? null,
        data_classification_label: policy.data_classification_label ?? null,
        fallback_action:           policy.fallback_action ?? null,
        coaching_template_id:      policy.coaching_template_id ?? null,
        vendor_translation_status: policy.vendor_translation_status ?? 'pending',
        required_dependencies:     policy.required_dependencies ?? [],
        test_status:               policy.test_status ?? 'untested',
        neutral_policy_json:       (policy.neutral_policy_json as Record<string, unknown>) ?? {},
        policy_key:                (policy as Record<string, unknown>).policy_key as string | null ?? null,
        neutral_policy_hash:       (policy as Record<string, unknown>).neutral_policy_hash as string | null ?? null,
        updated_at:                policy.updated_at,
        policy_source:             ((policy as Record<string, unknown>).policy_source as 'recommended' | 'manual') ?? 'manual',
        matrix_basis:              ((policy as Record<string, unknown>).matrix_basis as 'default' | 'customized' | null) ?? null,
        last_synced_from_matrix_at: ((policy as Record<string, unknown>).last_synced_from_matrix_at as string | null) ?? null,
      }}
      apps={apps}
      categories={categories}
      classificationLabels={classificationLabels.map(l => ({
        id:           l.id,
        system_level: l.system_level,
        name:         l.name,
        color:        l.color,
      }))}
      coachingTemplates={coachingTemplates}
      allPolicies={allPolicies}
      translations={translations}
      catalogDataTypes={catalogDataTypes}
    />
  )
}
