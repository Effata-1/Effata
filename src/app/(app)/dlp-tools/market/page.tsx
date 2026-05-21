import { requireRole } from '@/lib/auth'
import { getOnboardingProfile } from '@/app/onboarding/actions'
import { DLP_TOOLS } from '@/lib/onboarding/data'
import { cn } from '@/lib/utils'
import type { DlpToolChannelCoverage } from '@/lib/onboarding/data'

const CHANNEL_ROWS: { key: keyof DlpToolChannelCoverage; label: string }[] = [
  { key: 'email',       label: 'Email DLP' },
  { key: 'web',         label: 'Web DLP' },
  { key: 'saas-inline', label: 'SaaS Inline' },
  { key: 'saas-api',    label: 'SaaS API / At-Rest' },
  { key: 'endpoint',    label: 'Endpoint' },
  { key: 'genai',       label: 'GenAI / AI' },
  { key: 'network',     label: 'Network Egress' },
]

const LEVEL_STYLES = {
  full:    { label: 'Full',    className: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' },
  partial: { label: 'Partial', className: 'bg-amber-500/15 text-amber-400 border border-amber-500/20' },
  addon:   { label: 'Add-on',  className: 'bg-blue-500/15 text-blue-400 border border-blue-500/20' },
  none:    { label: '—',       className: 'text-muted-foreground/30' },
}

export default async function MarketPage() {
  await requireRole('analyst')
  const { data: profile } = await getOnboardingProfile()
  const orgTools: string[] = (profile?.tools as string[]) ?? []

  const tools = DLP_TOOLS.filter(t => t.channelCoverage && t.id !== 'no-tool' && t.id !== 'other-tool')

  return (
    <div className="space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Market Overview</h1>
        <p className="mt-1.5 text-sm text-muted-foreground max-w-2xl">
          Compare all major DLP platforms by channel coverage capability. Tools in your organisation&apos;s stack are highlighted.
        </p>
      </div>

      {/* Matrix */}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="sticky left-0 z-10 bg-muted/30 px-4 py-4 text-left text-xs font-semibold text-muted-foreground/70 w-44 min-w-[176px]">
                Channel
              </th>
              {tools.map(tool => {
                const inStack = orgTools.includes(tool.id)
                return (
                  <th key={tool.id} className="px-3 py-3 text-left align-top min-w-[152px]">
                    <div className="space-y-1.5">
                      <div className="flex items-start gap-1.5 flex-wrap">
                        <span className="text-xs font-semibold text-foreground leading-tight">{tool.label}</span>
                        {inStack && (
                          <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 leading-tight">
                            YOUR STACK
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground/60 leading-snug font-normal line-clamp-2">
                        {tool.description}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {tool.category?.map(cat => (
                          <span key={cat} className="px-1.5 py-0.5 rounded-sm text-[9px] font-semibold bg-muted border border-border text-muted-foreground/60">
                            {cat}
                          </span>
                        ))}
                      </div>
                    </div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {CHANNEL_ROWS.map(row => (
              <tr key={row.key} className="hover:bg-muted/10 transition-colors">
                <td className="sticky left-0 z-10 bg-background px-4 py-3 text-xs font-semibold text-foreground/80 border-r border-border">
                  {row.label}
                </td>
                {tools.map(tool => {
                  const level = tool.channelCoverage![row.key]
                  const style = LEVEL_STYLES[level]
                  return (
                    <td key={tool.id} className="px-3 py-3 text-center">
                      <span className={cn(
                        'inline-flex items-center justify-center px-2 py-0.5 rounded-md text-[10px] font-semibold',
                        style.className,
                      )}>
                        {style.label}
                      </span>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">Full</span>
          Native full coverage
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/20">Partial</span>
          Requires configuration or extra licence
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/20">Add-on</span>
          Available as paid add-on
        </span>
        <span className="flex items-center gap-1.5">
          <span className="text-muted-foreground/40 text-[10px] font-semibold pr-0.5">—</span>
          Not covered
        </span>
      </div>

    </div>
  )
}
