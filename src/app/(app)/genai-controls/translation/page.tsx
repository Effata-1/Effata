import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { TranslationHubClient } from './_components/translation-hub-client'

export default async function TranslationPage() {
  const user     = await requireRole('analyst')
  const supabase = await createClient()

  const [
    policiesResult,
    translationsResult,
    profileResult,
    latestJobResult,
  ] = await Promise.all([
    supabase
      .from('org_genai_policies')
      .select('id, name, policy_family, primary_action, approval_status, vendor_translation_status, priority')
      .eq('org_id', user.orgId)
      .order('priority')
      .order('created_at'),
    supabase
      .from('org_vendor_translations')
      .select('id, policy_id, vendor_id, status')
      .eq('org_id', user.orgId),
    supabase
      .from('onboarding_profiles')
      .select('tools')
      .eq('org_id', user.orgId)
      .maybeSingle(),
    supabase
      .from('ai_jobs')
      .select('id, status, created_at')
      .eq('org_id', user.orgId)
      .eq('job_type', 'policy-translate')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const policies     = policiesResult.data     ?? []
  const translations = translationsResult.data ?? []
  const tools        = (profileResult.data?.tools ?? []) as string[]
  const latestJob    = latestJobResult.data ?? null

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Policy Translation</h1>
          <p className="text-sm text-muted-foreground/70 mt-0.5">
            Translate your neutral DLP policies into vendor-native formats for deployment into your DLP tools.
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-2xl font-bold text-foreground">
            {translations.filter(t => t.status === 'translated' || t.status === 'verified').length}
          </p>
          <p className="text-xs text-muted-foreground/60">translations ready</p>
        </div>
      </div>

      <TranslationHubClient
        policies={policies}
        translations={translations}
        vendorTools={tools}
        latestJobId={latestJob?.id ?? null}
        latestJobStatus={latestJob?.status ?? null}
        userRole={user.role}
      />
    </div>
  )
}
