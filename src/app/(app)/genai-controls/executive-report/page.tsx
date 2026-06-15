import Link                                               from 'next/link'
import { requireRole }                                    from '@/lib/auth'
import { createClient }                                   from '@/lib/supabase/server'
import { cn }                                             from '@/lib/utils'
import { lintAllPolicies }                                from '@/lib/genai/lint'
import type { GenAIPolicy }                               from '@/lib/genai/types'
import { getNetskopeRecommendationForOrg }               from '@/lib/genai/netskope/get-recommendation'
import { TAG_ALIAS }                                      from '@/lib/genai/control-matrix-rows'
import { PresentationContainer }                          from './_components/presentation-container'
import { RecommendedPoliciesSection }                     from './_components/recommended-policies-section'
import type { PolicySlide, CategorySlide, OverrideSlide, CoachingSlide, AppCounts } from './_components/presentation-container'
import { getLatestPresentation }                          from './actions'


export default async function PresentationPage() {
  const user     = await requireRole('analyst')
  const supabase = await createClient()

  const [
    orgResult,
    profileResult,
    classificationsResult,
    policiesResult,
    existing,
    categoriesResult,
    overridesResult,
    coachingResult,
    recommendationResult,
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
        'id, name, description, policy_type, primary_action, data_classification_label, approval_status, ' +
        'is_active, scope_all_apps, scope_app_ids, rules, policy_owner, next_review_date, ' +
        'neutral_policy_json, policy_source, policy_family, test_status, priority',
      )
      .eq('org_id', user.orgId)
      .order('priority'),
    getLatestPresentation(),
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
    getNetskopeRecommendationForOrg(user.orgId).catch(() => null),
  ])

  const orgName         = (orgResult.data?.name ?? 'Your Organisation') as string
  const industry        = (profileResult.data?.industry as string | null) ?? 'Not specified'
  const classifications = classificationsResult.data ?? []
  const policies        = ((policiesResult.data ?? []) as unknown[]) as PolicySlide[]
  const categories      = ((categoriesResult.data ?? []) as unknown[]) as CategorySlide[]
  const overrides       = ((overridesResult.data ?? []) as unknown[]) as OverrideSlide[]
  const coaching        = ((coachingResult.data ?? []) as unknown[]) as CoachingSlide[]

  const canonical  = (cls: string) => TAG_ALIAS[cls] ?? cls
  const normCls    = classifications.map(c => canonical(c.customer_classification))
  const countBy    = (key: string) => normCls.filter(c => c === key).length
  const appCounts = {
    enterpriseApproved:       countBy('approved_supported'),
    approvedWithConditions:   countBy('approved_with_conditions'),
    permittedWithRestriction: countBy('restricted_unassessed'),
    prohibited:               countBy('prohibited'),
  }

  // Lint count for slide 6
  const lintIssues = lintAllPolicies(policies as unknown as GenAIPolicy[])
  const lintCount  = lintIssues.filter(i => i.severity === 'warning' || i.severity === 'error').length

  const recommendedPolicies = recommendationResult?.recommendation?.recommended_policies ?? []
  const scopedPolicies      = recommendationResult?.recommendation?.scoped_policies?.policies ?? []
  const manualPolicies      = recommendationResult?.recommendation?.manual_policies ?? []
  const totalNetskopePolicies = recommendedPolicies.length + scopedPolicies.length + manualPolicies.length

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="print:hidden">
        <h1 className="text-2xl font-bold text-foreground">Executive Report</h1>
        <p className="text-sm text-muted-foreground/70 mt-0.5">
          Print-ready policy pack for security leadership. Use &quot;Download PDF&quot; to export.
        </p>
      </div>

    <PresentationContainer
      existing={existing}
      orgName={orgName}
      industry={industry}
      categories={categories}
      matrixOverrides={overrides}
      coachingTemplates={coaching}
      policies={policies}
      appCounts={appCounts as AppCounts}
      lintCount={lintCount}
    >
      {/* ── Print document (unchanged) ──────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card shadow-sm print:shadow-none print:border-0 overflow-hidden">

        {/* Cover */}
        <div className="px-10 py-10 border-b border-border bg-gradient-to-br from-card to-muted/20 print:bg-white print:from-white print:to-white">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-2">Confidential — Internal Use</p>
              <h2 className="text-2xl font-bold text-foreground print:text-black">GenAI DLP Policy Pack</h2>
              <p className="text-base text-muted-foreground mt-1">{orgName}</p>
            </div>
            <div className="text-right text-xs text-muted-foreground/60 space-y-0.5">
              <p>Industry: <span className="text-foreground/80 capitalize">{industry}</span></p>
              <p>Policies: <span className="text-foreground/80">{totalNetskopePolicies}</span></p>
              <p>Generated: <span className="text-foreground/80">{new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span></p>
            </div>
          </div>
        </div>

        {/* Executive summary */}
        <div className="px-10 py-8 border-b border-border">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground/50 mb-4">Executive Summary</h3>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: 'Total Policies',        value: totalNetskopePolicies },
              { label: 'Recommended',           value: recommendedPolicies.length },
              { label: 'Scoped',                value: scopedPolicies.length },
              { label: 'Manual',                value: manualPolicies.length },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-lg border border-border bg-muted/20 px-4 py-3">
                <p className="text-xl font-bold text-foreground">{value}</p>
                <p className="text-[10px] text-muted-foreground/60 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* App governance breakdown */}
        <div className="px-10 py-8 border-b border-border">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground/50 mb-4">GenAI App Governance</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Approved & Supported',    value: appCounts.enterpriseApproved,       color: 'text-emerald-400' },
              { label: 'Approved w/ Conditions',  value: appCounts.approvedWithConditions,   color: 'text-blue-400' },
              { label: 'Restricted / Unassessed', value: appCounts.permittedWithRestriction, color: 'text-amber-400' },
              { label: 'Prohibited',              value: appCounts.prohibited,               color: 'text-red-400' },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-lg border border-border bg-muted/20 px-4 py-3">
                <p className={cn('text-xl font-bold', color)}>{value}</p>
                <p className="text-[10px] text-muted-foreground/60 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Recommended Netskope Policies */}
        <div className={cn('px-10 py-8', (scopedPolicies.length > 0 || manualPolicies.length > 0) && 'border-b border-border')}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground/50">
              Recommended Netskope Policies
              <span className="ml-2 normal-case tracking-normal font-normal">
                ({recommendedPolicies.length} {recommendedPolicies.length === 1 ? 'policy' : 'policies'})
              </span>
            </h3>
            <Link
              href="/genai-controls/netskope-pack"
              className="text-[10px] text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors"
            >
              View full pack →
            </Link>
          </div>
          <RecommendedPoliciesSection policies={recommendedPolicies} />
        </div>

        {/* Scoped Policies */}
        {scopedPolicies.length > 0 && (
          <div className={cn('px-10 py-8', manualPolicies.length > 0 && 'border-b border-border')}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground/50">
                Scoped Policies
                <span className="ml-2 normal-case tracking-normal font-normal">
                  ({scopedPolicies.length} {scopedPolicies.length === 1 ? 'policy' : 'policies'})
                </span>
              </h3>
              <span className="text-[10px] text-muted-foreground/40">User or destination-scoped overrides</span>
            </div>
            <RecommendedPoliciesSection policies={scopedPolicies} />
          </div>
        )}

        {/* Manual Policies */}
        {manualPolicies.length > 0 && (
          <div className="px-10 py-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground/50">
                Manual Policies
                <span className="ml-2 normal-case tracking-normal font-normal">
                  ({manualPolicies.length} {manualPolicies.length === 1 ? 'policy' : 'policies'})
                </span>
              </h3>
              <span className="text-[10px] text-muted-foreground/40">Custom policies not generated from the control matrix</span>
            </div>
            <RecommendedPoliciesSection policies={manualPolicies} />
          </div>
        )}

        {/* Footer */}
        <div className="px-10 py-4 border-t border-border bg-muted/10 flex items-center justify-between">
          <p className="text-[10px] text-muted-foreground/40">Confidential — {orgName} — {new Date().getFullYear()}</p>
          <p className="text-[10px] text-muted-foreground/30">Powered by Effata</p>
        </div>
      </div>
    </PresentationContainer>
    </div>
  )
}
