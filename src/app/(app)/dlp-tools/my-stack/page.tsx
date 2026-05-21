import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { getOnboardingProfile } from '@/app/onboarding/actions'
import { DLP_TOOLS } from '@/lib/onboarding/data'
import { CHANNELS } from '@/lib/channel-taxonomy'
import { deriveCoverage } from '@/lib/dlp-tools/derive-coverage'
import { cn } from '@/lib/utils'
import { MyStackEditor } from './_components/my-stack-editor'
import type { LicenceDetail } from './actions'
import { CoverageAssessment } from './_components/coverage-assessment'
import { AiReviewSection } from './_components/ai-review-section'
import type { CoverageStatus } from '@/lib/channel-taxonomy'
import type { DlpToolChannelCoverage } from '@/lib/onboarding/data'

const CHANNEL_LABELS: Record<string, string> = {
  email:         'Email DLP',
  web:           'Web DLP',
  'saas-inline': 'SaaS Inline',
  'saas-api':    'SaaS API / At-Rest',
  endpoint:      'Endpoint',
  genai:         'GenAI / AI',
  network:       'Network Egress',
}

const LEVEL_STYLES = {
  full:    { label: 'Full',    className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' },
  partial: { label: 'Partial', className: 'bg-amber-500/15 text-amber-400 border-amber-500/20' },
  addon:   { label: 'Add-on',  className: 'bg-blue-500/15 text-blue-400 border-blue-500/20' },
  none:    { label: 'Gap',     className: 'bg-red-500/15 text-red-400 border-red-500/20' },
}

const CHANNEL_KEYS = Object.keys(CHANNEL_LABELS) as (keyof DlpToolChannelCoverage)[]

export default async function MyStackPage() {
  const user = await requireRole('analyst')
  const supabase = await createClient()

  const [{ data: profile }, { data: channelRows }, { data: latestReview }] = await Promise.all([
    getOnboardingProfile(),
    supabase
      .from('channel_coverage')
      .select('channel_slug, assessment_answers')
      .eq('org_id', user.orgId),
    supabase
      .from('dlp_coverage_ai_reviews')
      .select('*')
      .eq('org_id', user.orgId)
      .order('reviewed_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const orgTools: string[]                              = (profile?.tools as string[]) ?? []
  const orgModules: Record<string, string[]>            = (profile?.modules as Record<string, string[]>) ?? {}
  const orgCoverageAreas: Record<string, string>        = (profile?.coverage_areas as Record<string, string>) ?? {}
  const orgLicenceDetails: Record<string, LicenceDetail> = (profile?.licence_details as Record<string, LicenceDetail>) ?? {}

  const channelAnswers: Record<string, Record<string, CoverageStatus>> = {}
  for (const row of channelRows ?? []) {
    channelAnswers[row.channel_slug] = row.assessment_answers as Record<string, CoverageStatus>
  }

  const derivedCoverage = deriveCoverage(orgTools, DLP_TOOLS)

  return (
    <div className="max-w-5xl space-y-12">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">My Stack</h1>
        <p className="mt-1.5 text-sm text-muted-foreground max-w-2xl">
          Your organisation&apos;s DLP tool configuration, derived channel coverage, deep assessment, and AI-driven review.
        </p>
      </div>

      {/* Section 1: Tools & Modules */}
      <MyStackEditor
        allTools={DLP_TOOLS}
        initialTools={orgTools}
        initialModules={orgModules}
        initialCoverageAreas={orgCoverageAreas}
        initialLicenceDetails={orgLicenceDetails}
      />

      {/* Section 2: Derived Coverage */}
      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Derived Coverage</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Auto-calculated from your selected tools. Shows the best coverage level across your entire stack.
          </p>
        </div>
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground/70 w-44">Channel</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground/70 w-28">Coverage</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground/70">Covered By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {CHANNEL_KEYS.map(key => {
                const entry = derivedCoverage[key]
                const style = LEVEL_STYLES[entry.level]
                return (
                  <tr key={key} className="hover:bg-muted/10 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-foreground/80">{CHANNEL_LABELS[key]}</td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        'inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-semibold',
                        style.className,
                      )}>
                        {style.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {entry.coveredBy.length > 0 ? entry.coveredBy.join(', ') : (
                        <span className="text-muted-foreground/40 italic">No coverage</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Section 3: Deep Assessment */}
      <CoverageAssessment
        channels={CHANNELS}
        channelAnswers={channelAnswers}
        derivedCoverage={derivedCoverage}
      />

      {/* Section 4: AI Review */}
      <AiReviewSection latestReview={latestReview ?? null} />

    </div>
  )
}
