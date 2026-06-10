import Link from 'next/link'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { CHANNELS, type NetskopeSupportLevel } from '@/lib/channel-taxonomy'

const NETSKOPE_STYLES: Record<NetskopeSupportLevel, { label: string; className: string }> = {
  supported: { label: 'Full Support',    className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' },
  partial:   { label: 'Partial Support', className: 'bg-amber-500/15 text-amber-400 border-amber-500/20'     },
  not_v1:    { label: 'Out of V1 Scope', className: 'bg-muted text-muted-foreground border-border'           },
}

export default async function ChannelsIndexPage() {
  const user     = await requireRole('analyst')
  const supabase = await createClient()

  const { data: rows } = await supabase
    .from('channel_coverage')
    .select('channel_slug, assessment_answers')
    .eq('org_id', user.orgId)

  const coverageMap = new Map(
    (rows ?? []).map(r => [r.channel_slug as string, r.assessment_answers as Record<string, string>]),
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Channels</h1>
        <p className="text-sm text-muted-foreground/70 mt-0.5">
          DLP coverage across the eight data movement channels.
        </p>
      </div>
      <div className="grid gap-3">
        {CHANNELS.map(ch => {
          const answers  = coverageMap.get(ch.slug) ?? {}
          // Use taxonomy as denominator — saved answers may be a subset of all questions
          const total    = ch.assessmentQuestions.length
          const covered  = ch.assessmentQuestions.filter(q => answers[q.key] === 'covered').length
          const assessed = ch.assessmentQuestions.some(q => answers[q.key] && answers[q.key] !== 'not_assessed')
          const meta     = NETSKOPE_STYLES[ch.netskopeSupport]
          return (
            <Link
              key={ch.slug}
              href={`/foundation/channels/${ch.slug}`}
              className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card/40 px-5 py-4 hover:bg-card transition-colors group"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground group-hover:text-foreground">{ch.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{ch.definition}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {assessed && (
                  <span className="text-xs text-muted-foreground">{covered}/{total} covered</span>
                )}
                <span className={cn(
                  'inline-flex items-center px-2.5 py-1 rounded-md border text-[11px] font-medium',
                  meta.className,
                )}>
                  {meta.label}
                </span>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
