import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { TranslationReviewClient } from './_components/translation-review-client'

interface Props {
  params: Promise<{ policyId: string }>
}

export default async function TranslationReviewPage({ params }: Props) {
  const { policyId } = await params
  const user         = await requireRole('analyst')
  const supabase     = await createClient()

  const [
    policyResult,
    translationsResult,
    profileResult,
  ] = await Promise.all([
    supabase
      .from('org_genai_policies')
      .select('id, name, description, policy_type, policy_family, primary_action, approval_status, vendor_translation_status, priority, scope_all_apps, scope_app_ids, rules, data_classification_label, neutral_policy_json')
      .eq('id', policyId)
      .eq('org_id', user.orgId)
      .maybeSingle(),
    supabase
      .from('org_vendor_translations')
      .select('id, vendor_id, status, native_policies, mapping_report, adapter_version, capability_registry_version, neutral_policy_hash, reviewed_by, reviewed_at, exported_at, created_at, updated_at')
      .eq('org_id', user.orgId)
      .eq('policy_id', policyId),
    supabase
      .from('onboarding_profiles')
      .select('tools')
      .eq('org_id', user.orgId)
      .maybeSingle(),
  ])

  if (!policyResult.data) notFound()

  const policy       = policyResult.data
  const translations = translationsResult.data ?? []
  const tools        = (profileResult.data?.tools ?? []) as string[]

  return (
    <TranslationReviewClient
      policy={policy}
      translations={translations}
      vendorTools={tools}
    />
  )
}
