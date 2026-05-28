import { createClient } from '@supabase/supabase-js'
import { cn } from '@/lib/utils'
import type { PresentationSnapshot } from '@/app/(app)/genai-controls/presentation/actions'

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

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  const { data } = await supabase
    .from('genai_presentations')
    .select('id, title, snapshot, created_at')
    .eq('public_token', token)
    .eq('is_public', true)
    .is('revoked_at', null)
    .maybeSingle()

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3 max-w-sm px-6">
          <div className="w-12 h-12 rounded-xl bg-card border border-border flex items-center justify-center mx-auto">
            <svg className="w-6 h-6 text-muted-foreground/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
          <h1 className="text-sm font-semibold text-foreground/70">Link expired or revoked</h1>
          <p className="text-xs text-muted-foreground/50">This presentation link is no longer active. Contact the sender to request a new link.</p>
        </div>
      </div>
    )
  }

  const snapshot = data.snapshot as PresentationSnapshot
  const createdAt = new Date(data.created_at as string).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-4xl mx-auto space-y-0 rounded-xl border border-border bg-card shadow-sm overflow-hidden">

        {/* Cover */}
        <div className="px-10 py-10 border-b border-border bg-gradient-to-br from-card to-muted/20">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-2">Confidential — Internal Use</p>
              <h1 className="text-2xl font-bold text-foreground">{data.title as string}</h1>
              <p className="text-base text-muted-foreground mt-1">{snapshot.org_name}</p>
            </div>
            <div className="text-right text-xs text-muted-foreground/60 space-y-0.5">
              <p>Industry: <span className="text-foreground/80 capitalize">{snapshot.industry}</span></p>
              <p>Policies: <span className="text-foreground/80">{snapshot.policies.length}</span></p>
              <p>Generated: <span className="text-foreground/80">{createdAt}</span></p>
            </div>
          </div>
        </div>

        {/* Executive summary */}
        <div className="px-10 py-8 border-b border-border">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground/50 mb-4">Executive Summary</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: 'Total Policies',         value: snapshot.policies.length },
              { label: 'Approved',               value: snapshot.policies.filter(p => p.approval_status === 'approved').length },
              { label: 'Draft',                  value: snapshot.policies.filter(p => p.approval_status === 'draft').length },
              { label: 'GenAI Apps Classified',  value: snapshot.app_counts.total },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-lg border border-border bg-muted/20 px-4 py-3">
                <p className="text-xl font-bold text-foreground">{value}</p>
                <p className="text-[10px] text-muted-foreground/60 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* App governance */}
        <div className="px-10 py-8 border-b border-border">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground/50 mb-4">GenAI App Governance</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Approved & Supported',    value: snapshot.app_counts.enterprise_approved,        color: 'text-emerald-400' },
              { label: 'Approved w/ Conditions', value: snapshot.app_counts.approved_with_conditions,   color: 'text-blue-400' },
              { label: 'Restricted / Unassessed', value: snapshot.app_counts.permitted_with_restriction, color: 'text-amber-400' },
              { label: 'Prohibited',              value: snapshot.app_counts.prohibited,                 color: 'text-red-400' },
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
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground/50 mb-4">
            Policy Library <span className="ml-2 normal-case tracking-normal font-normal">({snapshot.policies.length} {snapshot.policies.length === 1 ? 'policy' : 'policies'})</span>
          </h2>
          <div className="space-y-3">
            {snapshot.policies.map((policy, i) => (
              <div key={i} className="rounded-lg border border-border bg-muted/10 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] text-muted-foreground/40 font-mono">{String(i + 1).padStart(2, '0')}</span>
                      <p className="text-sm font-semibold text-foreground/90 leading-tight">{policy.name}</p>
                    </div>
                    {policy.description && (
                      <p className="text-xs text-muted-foreground/60 mt-1 leading-relaxed">{policy.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted/40 border border-border text-muted-foreground/60 capitalize">
                        {policy.policy_type.replace('-', ' ')}
                      </span>
                      {policy.data_classification_label && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted/40 border border-border text-muted-foreground/60 capitalize">
                          {policy.data_classification_label === 'all' ? 'All data' : policy.data_classification_label}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    {policy.primary_action && (
                      <span className={cn(
                        'text-[10px] font-semibold px-2 py-0.5 rounded border whitespace-nowrap',
                        ACTION_CHIP[policy.primary_action] ?? 'bg-muted/40 text-muted-foreground border-border',
                      )}>
                        {policy.primary_action.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                      </span>
                    )}
                    <span className={cn(
                      'text-[10px] font-bold px-2 py-0.5 rounded border whitespace-nowrap',
                      APPROVAL_CHIP[policy.approval_status] ?? 'bg-muted/60 text-muted-foreground border-border',
                    )}>
                      {policy.approval_status.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-10 py-4 border-t border-border bg-muted/10 flex items-center justify-between">
          <p className="text-[10px] text-muted-foreground/40">Confidential — {snapshot.org_name} — {new Date(snapshot.generated_at).getFullYear()}</p>
          <p className="text-[10px] text-muted-foreground/30">Powered by Effata</p>
        </div>
      </div>
    </div>
  )
}
