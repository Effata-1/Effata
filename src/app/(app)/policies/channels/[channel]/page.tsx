import { notFound } from 'next/navigation'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { getChannel, CHANNEL_SLUGS, type RiskLevel, type CoverageStatus } from '@/lib/channel-taxonomy'
import { ChannelAssessment } from './_components/channel-assessment'
import { SubchannelList } from './_components/subchannel-list'

// ─── Risk level badge ────────────────────────────────────────────────────────

const RISK_STYLES: Record<RiskLevel, string> = {
  critical: 'bg-red-500/15 text-red-400 border-red-500/20',
  high:     'bg-orange-500/15 text-orange-400 border-orange-500/20',
  medium:   'bg-amber-500/15 text-amber-400 border-amber-500/20',
  low:      'bg-blue-500/15 text-blue-400 border-blue-500/20',
}

// ─── Netskope badge ──────────────────────────────────────────────────────────

const NETSKOPE_STYLES = {
  supported: { label: 'Netskope: Full Support',    className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' },
  partial:   { label: 'Netskope: Partial Support', className: 'bg-amber-500/15 text-amber-400 border-amber-500/20' },
  not_v1:    { label: 'Netskope: Out of V1 Scope', className: 'bg-muted text-muted-foreground border-border' },
}

// ─── Page ────────────────────────────────────────────────────────────────────

export function generateStaticParams() {
  return CHANNEL_SLUGS.map(slug => ({ channel: slug }))
}

export default async function ChannelPage({ params }: { params: Promise<{ channel: string }> }) {
  const { channel: slug } = await params
  const ch = getChannel(slug)
  if (!ch) notFound()

  const user = await requireRole('analyst')
  const supabase = await createClient()

  const { data: row } = await supabase
    .from('channel_coverage')
    .select('assessment_answers')
    .eq('org_id', user.orgId)
    .eq('channel_slug', slug)
    .maybeSingle()

  const initialAnswers = (row?.assessment_answers ?? {}) as Record<string, CoverageStatus>
  const netskopeMeta   = NETSKOPE_STYLES[ch.netskopeSupport]

  return (
    <div className="max-w-4xl space-y-10">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{ch.name}</h1>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed max-w-2xl">{ch.definition}</p>
        </div>
        <span className={cn(
          'shrink-0 mt-1 inline-flex items-center px-3 py-1.5 rounded-lg border text-xs font-medium',
          netskopeMeta.className,
        )}>
          {netskopeMeta.label}
        </span>
      </div>

      {/* ── Subchannels ────────────────────────────────────────────────────── */}
      {ch.subchannels.length > 0 && (
        <section className="space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Subchannels</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Specific movement or exposure paths within this channel. Click any row to expand.</p>
          </div>
          <SubchannelList subchannels={ch.subchannels} />
        </section>
      )}

      {/* ── Risks ──────────────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Risks</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Key risks associated with this channel, mapped by severity.</p>
        </div>
        <div className="rounded-xl border border-border bg-card/40 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground/70 w-44">Risk Area</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground/70 w-28">Level</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground/70">Description</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground/70 hidden lg:table-cell">Example</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {ch.risks.map(risk => (
                <tr key={risk.area} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-foreground/90">{risk.area}</td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      'inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-semibold uppercase tracking-wide',
                      RISK_STYLES[risk.level],
                    )}>
                      {risk.level}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground leading-relaxed">{risk.description}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground/70 italic hidden lg:table-cell">{risk.example}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Assessment ─────────────────────────────────────────────────────── */}
      <ChannelAssessment
        channelSlug={slug}
        questions={ch.assessmentQuestions}
        initialAnswers={initialAnswers}
      />

    </div>
  )
}
