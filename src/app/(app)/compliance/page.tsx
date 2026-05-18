import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { DLP_CONTROLS } from '@/lib/compliance/controls'
import { cn } from '@/lib/utils'
import { FileText, BarChart2, ClipboardCheck, ChevronRight, ArrowRight } from 'lucide-react'

const CONTROL_COUNT = DLP_CONTROLS.length

const STATUS_STYLE: Record<string, { color: string; bg: string; label: string }> = {
  implemented:     { color: 'text-green-400', bg: 'bg-green-500/15', label: 'Implemented' },
  partial:         { color: 'text-amber-400', bg: 'bg-amber-500/15', label: 'Partial' },
  not_implemented: { color: 'text-red-400',   bg: 'bg-red-500/15',   label: 'Not Implemented' },
  not_assessed:    { color: 'text-zinc-400',  bg: 'bg-zinc-700/50',  label: 'Not Assessed' },
}

// Maps onboarding region IDs → regulation region strings (mirror of regulations/page.tsx)
const ORG_REGION_MAP: Record<string, string[]> = {
  'european-union': ['EU', 'EEA'],
  'united-kingdom': ['UK'],
  'india':          ['India'],
  'united-states':  ['US', 'California, United States'],
  'canada':         ['Canada'],
  'brazil':         ['Brazil'],
  'singapore':      ['Singapore'],
  'china':          ['China'],
  'japan':          ['Japan'],
  'south-korea':    ['South Korea'],
  'australia':      ['Australia'],
  'apac':           ['Singapore', 'Japan', 'Australia', 'South Korea', 'China'],
  'saudi-arabia':   ['Saudi Arabia'],
  'uae':            ['UAE'],
  'middle-east':    ['Saudi Arabia', 'UAE'],
  'south-africa':   ['South Africa'],
  'africa':         ['South Africa'],
  'latin-america':  ['Brazil'],
}

const ORG_INDUSTRY_MAP: Record<string, string[]> = {
  'financial-services': ['financial'],
  'banking':            ['financial'],
  'insurance':          ['financial'],
  'healthcare':         ['healthcare'],
  'life-sciences':      ['healthcare'],
  'technology-saas':    ['technology'],
  'software-engineering': ['technology'],
  'retail-ecommerce':   ['retail'],
  'hospitality-travel': ['retail'],
  'energy-utilities':   ['critical_infrastructure', 'energy'],
  'manufacturing':      ['critical_infrastructure'],
  'automotive':         ['automotive', 'transport'],
  'logistics-transport': ['transport', 'critical_infrastructure'],
  'telecom':            ['telecom', 'digital_infrastructure'],
  'government':         ['government', 'defence'],
  'education':          ['education'],
  'legal':              ['legal'],
  'professional-services': ['legal'],
  'media-entertainment': ['media'],
  'non-profit':         [],
  'other':              [],
}

function computeScore(assessments: { status: string }[]): number {
  let score = 0
  for (const a of assessments) {
    if (a.status === 'implemented') score += 1
    if (a.status === 'partial')     score += 0.5
  }
  return Math.round((score / CONTROL_COUNT) * 100)
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default async function CompliancePage() {
  const supabase = await createClient()

  const [
    { data: regsData },
    { data: assessmentsData },
    { data: recentLogs },
    { data: profileData },
  ] = await Promise.all([
    supabase
      .from('compliance_regulations')
      .select('id, code, short_name, regions, industries')
      .eq('active', true)
      .order('short_name'),
    supabase
      .from('compliance_assessments')
      .select('regulation_id, control_key, status'),
    supabase
      .from('audit_logs')
      .select('id, created_at, user_email, entity_name, old_value, new_value, details')
      .eq('action', 'compliance.assessment_updated')
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('onboarding_profiles')
      .select('regions, industry')
      .maybeSingle(),
  ])

  const regs = regsData ?? []
  const allAssessments = (assessmentsData ?? []) as { regulation_id: string; control_key: string; status: string }[]
  const logs = (recentLogs ?? []) as { id: string; created_at: string; user_email: string | null; entity_name: string; old_value: string | null; new_value: string | null; details: { regulation_id?: string } }[]

  const orgRegions: string[] = profileData?.regions ?? []
  const orgIndustry: string | null = profileData?.industry ?? null
  const isGlobal = orgRegions.includes('global')
  const orgRegionStrings = orgRegions.flatMap(r => ORG_REGION_MAP[r] ?? [])
  const mappedIndustries = orgIndustry ? (ORG_INDUSTRY_MAP[orgIndustry] ?? []) : []

  // Which regulations are relevant to this org
  const relevantIds = new Set(
    regs
      .filter(r => {
        if (!isGlobal && orgRegionStrings.length === 0) return false
        const regIsGlobal = r.regions.some((regR: string) => regR === 'Global')
        const regionMatch = isGlobal || regIsGlobal || orgRegionStrings.some(orgR =>
          r.regions.some((regR: string) => regR.includes(orgR) || orgR.includes(regR))
        )
        if (!regionMatch) return false
        if (r.industries === null) return true
        if (!orgIndustry) return true
        return mappedIndustries.some((i: string) => r.industries.includes(i))
      })
      .map(r => r.id)
  )

  // Group assessments by regulation
  const byReg = new Map<string, { status: string }[]>()
  for (const a of allAssessments) {
    if (!byReg.has(a.regulation_id)) byReg.set(a.regulation_id, [])
    byReg.get(a.regulation_id)!.push({ status: a.status })
  }

  // Regulations with at least one non-default assessment
  const assessedRegIds = new Set(
    [...byReg.entries()]
      .filter(([, entries]) => entries.some(e => e.status !== 'not_assessed'))
      .map(([id]) => id)
  )

  // Compute score per assessed regulation
  const regScores = regs
    .filter(r => assessedRegIds.has(r.id))
    .map(r => ({
      id:         r.id,
      code:       r.code,
      short_name: r.short_name,
      score:      computeScore(byReg.get(r.id) ?? []),
      isRelevant: relevantIds.has(r.id),
    }))
    .sort((a, b) => a.score - b.score) // weakest first

  const avgScore = regScores.length > 0
    ? Math.round(regScores.reduce((s, r) => s + r.score, 0) / regScores.length)
    : null

  // Regulation name lookup for activity feed
  const regNameMap = new Map(regs.map(r => [r.id, r.short_name]))

  // Control label lookup
  const ctrlMap = new Map(DLP_CONTROLS.map(c => [c.key, c.label]))

  const totalRegs   = regs.length
  const assessedCount = assessedRegIds.size
  const relevantCount = relevantIds.size

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Compliance</h1>
        <p className="text-zinc-500 text-sm">
          Your organisation's DLP compliance posture across all tracked regulations.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-5 py-4">
          <div className="text-2xl font-bold text-white tabular-nums">{totalRegs}</div>
          <div className="text-xs text-zinc-500 mt-0.5">Regulations tracked</div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-5 py-4">
          <div className="text-2xl font-bold text-white tabular-nums">
            {assessedCount}
            <span className="text-zinc-600 text-base font-normal">/{totalRegs}</span>
          </div>
          <div className="text-xs text-zinc-500 mt-0.5">Regulations assessed</div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-5 py-4">
          {avgScore !== null ? (
            <>
              <div className={cn(
                'text-2xl font-bold tabular-nums',
                avgScore >= 80 ? 'text-green-400' : avgScore >= 50 ? 'text-amber-400' : 'text-red-400'
              )}>
                {avgScore}%
              </div>
              <div className="text-xs text-zinc-500 mt-0.5">Avg compliance score</div>
              <div className="mt-2 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    avgScore >= 80 ? 'bg-green-500' : avgScore >= 50 ? 'bg-amber-500' : 'bg-red-500'
                  )}
                  style={{ width: `${avgScore}%` }}
                />
              </div>
            </>
          ) : (
            <>
              <div className="text-2xl font-bold text-zinc-600">—</div>
              <div className="text-xs text-zinc-500 mt-0.5">Avg compliance score</div>
              <div className="text-[10px] text-zinc-600 mt-1">No assessments yet</div>
            </>
          )}
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-5 py-4">
          <div className="text-2xl font-bold text-white tabular-nums">{relevantCount}</div>
          <div className="text-xs text-zinc-500 mt-0.5">Apply to your org</div>
          {relevantCount === 0 && (
            <div className="text-[10px] text-zinc-600 mt-1">Complete onboarding to see</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Regulation scores */}
        <div className="lg:col-span-3 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Regulation Scores</h2>
            <Link
              href="/compliance/gap-report"
              className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Open Gap Report
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {regScores.length === 0 ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-6 py-10 text-center">
              <BarChart2 className="h-8 w-8 text-zinc-700 mx-auto mb-3" />
              <p className="text-sm text-zinc-400 font-medium">No assessments yet</p>
              <p className="text-xs text-zinc-600 mt-1 mb-4">
                Start assessing your DLP controls against any regulation.
              </p>
              <Link
                href="/compliance/gap-report"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-400 border border-blue-500/40 rounded-lg px-3 py-1.5 hover:bg-blue-500/10 transition-colors"
              >
                <ClipboardCheck className="h-3.5 w-3.5" />
                Start your first assessment
              </Link>
            </div>
          ) : (
            <div className="rounded-xl border border-zinc-800 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-900/80">
                    <th className="text-left text-[10px] font-semibold text-zinc-600 uppercase tracking-wide px-5 py-2.5">Regulation</th>
                    <th className="text-left text-[10px] font-semibold text-zinc-600 uppercase tracking-wide px-4 py-2.5 w-40">Score</th>
                    <th className="w-10 px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {regScores.map(r => (
                    <tr key={r.id} className="hover:bg-zinc-900/40 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-white">{r.short_name}</span>
                          {r.isRelevant && (
                            <span className="text-[10px] px-1 py-0.5 rounded bg-blue-500/15 text-blue-400">your org</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                            <div
                              className={cn(
                                'h-full rounded-full',
                                r.score >= 80 ? 'bg-green-500' : r.score >= 50 ? 'bg-amber-500' : 'bg-red-500'
                              )}
                              style={{ width: `${r.score}%` }}
                            />
                          </div>
                          <span className={cn(
                            'text-xs font-semibold tabular-nums w-8 text-right',
                            r.score >= 80 ? 'text-green-400' : r.score >= 50 ? 'text-amber-400' : 'text-red-400'
                          )}>
                            {r.score}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/compliance/gap-report?reg=${r.code}`}
                          className="text-zinc-600 hover:text-zinc-300 transition-colors"
                          title="Open in Gap Report"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Unassessed relevant regs prompt */}
              {relevantCount > assessedCount && (
                <div className="border-t border-zinc-800 px-5 py-3 bg-zinc-900/60 flex items-center justify-between">
                  <span className="text-xs text-zinc-500">
                    {relevantCount - assessedRegIds.size > 0
                      ? `${[...relevantIds].filter(id => !assessedRegIds.has(id)).length} applicable regulation${[...relevantIds].filter(id => !assessedRegIds.has(id)).length === 1 ? '' : 's'} not yet assessed`
                      : 'All applicable regulations assessed'
                    }
                  </span>
                  <Link
                    href="/compliance/regulations?region=my-regions"
                    className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    View all →
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="lg:col-span-2 space-y-3">
          {/* Recent activity */}
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Recent Activity</h2>
            <Link
              href="/compliance/audit-trail"
              className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Full trail
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {logs.length === 0 ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-6 py-10 text-center">
              <FileText className="h-8 w-8 text-zinc-700 mx-auto mb-3" />
              <p className="text-sm text-zinc-400 font-medium">No activity yet</p>
              <p className="text-xs text-zinc-600 mt-1">
                Assessment changes will appear here.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-zinc-800 overflow-hidden divide-y divide-zinc-800/60">
              {logs.map(log => {
                const regName  = regNameMap.get(log.details?.regulation_id ?? '') ?? '—'
                const ctrlName = ctrlMap.get(log.entity_name) ?? log.entity_name
                const newStyle = log.new_value ? (STATUS_STYLE[log.new_value] ?? STATUS_STYLE.not_assessed) : STATUS_STYLE.not_assessed
                return (
                  <div key={log.id} className="px-4 py-3 hover:bg-zinc-900/40 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs text-white font-medium truncate">{ctrlName}</div>
                        <div className="text-[10px] text-zinc-500 mt-0.5">{regName} · {log.user_email ?? 'unknown'}</div>
                      </div>
                      <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0', newStyle.color, newStyle.bg)}>
                        {newStyle.label}
                      </span>
                    </div>
                    <div className="text-[10px] text-zinc-600 mt-1">{formatDate(log.created_at)}</div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Quick links */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 overflow-hidden divide-y divide-zinc-800/60">
            {[
              { href: '/compliance/regulations', icon: FileText,       label: 'Regulations & Frameworks', sub: `${totalRegs} tracked` },
              { href: '/compliance/gap-report',  icon: ClipboardCheck, label: 'Gap Report',           sub: `${assessedCount} assessed` },
              { href: '/compliance/audit-trail', icon: BarChart2,      label: 'Audit Trail',          sub: `${logs.length > 0 ? 'Recent activity' : 'No activity yet'}` },
            ].map(({ href, icon: Icon, label, sub }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-900/60 transition-colors group"
              >
                <Icon className="h-4 w-4 text-zinc-600 group-hover:text-zinc-400 transition-colors shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-white">{label}</div>
                  <div className="text-[10px] text-zinc-600">{sub}</div>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-zinc-700 group-hover:text-zinc-500 transition-colors" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
