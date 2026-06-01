import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'
import { PresentationActionsBar } from './_components/presentation-actions-bar'
import { getLatestPresentation } from './actions'

const ACTION_CHIP: Record<string, string> = {
  allow:       'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  monitor:     'bg-blue-500/10 text-blue-400 border-blue-500/20',
  alert:       'bg-amber-500/10 text-amber-400 border-amber-500/20',
  coach:       'bg-orange-500/10 text-orange-400 border-orange-500/20',
  'coach-ack': 'bg-orange-500/15 text-orange-300 border-orange-500/30',
  'coach-just':'bg-amber-600/15 text-amber-300 border-amber-600/25',
  block:       'bg-red-500/10 text-red-400 border-red-500/20',
}

const APPROVAL_CHIP: Record<string, string> = {
  approved:       'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  'under-review': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  draft:          'bg-muted/60 text-muted-foreground border-border',
  rejected:       'bg-red-500/10 text-red-400 border-red-500/20',
  expired:        'bg-amber-500/10 text-amber-400 border-amber-500/20',
}

export default async function PresentationPage() {
  const user    = await requireRole('analyst')
  const supabase = await createClient()

  const [orgResult, profileResult, classificationsResult, policiesResult, existing] =
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
        .select('id, name, description, policy_type, primary_action, data_classification_label, approval_status')
        .eq('org_id', user.orgId)
        .order('priority'),
      getLatestPresentation(),
    ])

  const orgName        = (orgResult.data?.name ?? 'Your Organisation') as string
  const industry       = (profileResult.data?.industry as string | null) ?? 'Not specified'
  const classifications = classificationsResult.data ?? []
  const policies        = policiesResult.data ?? []

  const countBy = (cls: string) => classifications.filter(c => c.customer_classification === cls).length
  const appCounts = {
    enterpriseApproved:       countBy('enterprise-approved'),
    approvedWithConditions:   countBy('approved-with-conditions'),
    permittedWithRestriction: countBy('permitted-with-restriction'),
    prohibited:               countBy('prohibited'),
  }

  const approvedCount = policies.filter(p => p.approval_status === 'approved').length
  const draftCount    = policies.filter(p => p.approval_status === 'draft').length

  return (
    <div className="space-y-8">
      {/* Page header — hidden on print */}
      <div className="print:hidden flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">CISO Presentation</h1>
          <p className="text-sm text-muted-foreground/70 mt-0.5">
            Print-ready policy pack for security leadership. Use &quot;Download PDF&quot; to export.
          </p>
        </div>
      </div>

      {/* Share / Revoke bar */}
      <PresentationActionsBar existing={existing} />

      {/* ── Print document begins ─────────────────────────────────────────── */}
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
              <p>Policies: <span className="text-foreground/80">{policies.length}</span></p>
              <p>Generated: <span className="text-foreground/80">{new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span></p>
            </div>
          </div>
        </div>

        {/* Executive summary */}
        <div className="px-10 py-8 border-b border-border">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground/50 mb-4">Executive Summary</h3>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: 'Total Policies',   value: policies.length },
              { label: 'Approved',          value: approvedCount },
              { label: 'Draft',             value: draftCount },
              { label: 'GenAI Apps Classified', value: Object.values(appCounts).reduce((a, b) => a + b, 0) },
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
              { label: 'Approved w/ Conditions', value: appCounts.approvedWithConditions,   color: 'text-blue-400' },
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

        {/* Policy list */}
        <div className="px-10 py-8">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground/50 mb-4">
            Policy Library <span className="ml-2 normal-case tracking-normal font-normal">({policies.length} {policies.length === 1 ? 'policy' : 'policies'})</span>
          </h3>

          {policies.length === 0 ? (
            <p className="text-sm text-muted-foreground/50 italic">No policies have been created yet. Complete the setup wizard to generate your first policy set.</p>
          ) : (
            <div className="space-y-3">
              {policies.map((policy, i) => (
                <div key={policy.id as string} className="rounded-lg border border-border bg-muted/10 px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] text-muted-foreground/40 font-mono">{String(i + 1).padStart(2, '0')}</span>
                        <p className="text-sm font-semibold text-foreground/90 leading-tight">{policy.name as string}</p>
                      </div>
                      {(policy.description as string | null) && (
                        <p className="text-xs text-muted-foreground/60 mt-1 leading-relaxed">{policy.description as string}</p>
                      )}
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted/40 border border-border text-muted-foreground/60 capitalize">
                          {(policy.policy_type as string).replace('-', ' ')}
                        </span>
                        {(policy.data_classification_label as string | null) && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted/40 border border-border text-muted-foreground/60 capitalize">
                            {(policy.data_classification_label as string) === 'all' ? 'All data' : (policy.data_classification_label as string)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      {(policy.primary_action as string | null) && (
                        <span className={cn(
                          'text-[10px] font-semibold px-2 py-0.5 rounded border whitespace-nowrap',
                          ACTION_CHIP[policy.primary_action as string] ?? 'bg-muted/40 text-muted-foreground border-border',
                        )}>
                          {(policy.primary_action as string).replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                        </span>
                      )}
                      <span className={cn(
                        'text-[10px] font-bold px-2 py-0.5 rounded border whitespace-nowrap',
                        APPROVAL_CHIP[policy.approval_status as string] ?? 'bg-muted/60 text-muted-foreground border-border',
                      )}>
                        {(policy.approval_status as string).replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-10 py-4 border-t border-border bg-muted/10 flex items-center justify-between">
          <p className="text-[10px] text-muted-foreground/40">Confidential — {orgName} — {new Date().getFullYear()}</p>
          <p className="text-[10px] text-muted-foreground/30">Powered by Effata</p>
        </div>
      </div>
    </div>
  )
}
