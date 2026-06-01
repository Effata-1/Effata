import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { DLP_CONTROLS } from '@/lib/compliance/controls'
import { isRelevantToOrg } from '@/lib/compliance/org-mappings'
import { cn } from '@/lib/utils'
import { FileText, BarChart2, ClipboardCheck, ChevronRight, ArrowRight } from 'lucide-react'

const CONTROL_COUNT = DLP_CONTROLS.length

const STATUS_STYLE: Record<string, { color: string; bg: string; label: string }> = {
  implemented:     { color: 'text-green-400', bg: 'bg-green-500/15', label: 'Implemented' },
  partial:         { color: 'text-amber-400', bg: 'bg-amber-500/15', label: 'Partial' },
  not_implemented: { color: 'text-red-400',   bg: 'bg-red-500/15',   label: 'Not Implemented' },
  not_assessed:    { color: 'text-muted-foreground',  bg: 'bg-accent/50',  label: 'Not Assessed' },
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

  // eslint-disable-next-line react-hooks/purity
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const [
    { data: regsData },
    { data: assessmentsData },
    { data: recentLogs },
    { data: profileData },
    { data: trendData },
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
    // Oldest-first so the first entry per (reg, control) gives the state 30 days ago
    supabase
      .from('audit_logs')
      .select('entity_name, old_value, details')
      .eq('action', 'compliance.assessment_updated')
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: true })
      .limit(500),
  ])

  const regs = regsData ?? []
  const allAssessments = (assessmentsData ?? []) as { regulation_id: string; control_key: string; status: string }[]
  const logs = (recentLogs ?? []) as { id: string; created_at: string; user_email: string | null; entity_name: string; old_value: string | null; new_value: string | null; details: { regulation_id?: string } }[]
  const recentChanges = (trendData ?? []) as { entity_name: string; old_value: string | null; details: { regulation_id?: string } }[]

  const orgRegions: string[] = profileData?.regions ?? []
  const orgIndustry: string | null = profileData?.industry ?? null

  const relevantIds = new Set(
    regs
      .filter(r => isRelevantToOrg(r, orgRegions, orgIndustry))
      .map(r => r.id)
  )

  // Group current assessments by regulation, keeping control_key for trend reconstruction
  const byReg = new Map<string, { control_key: string; status: string }[]>()
  for (const a of allAssessments) {
    if (!byReg.has(a.regulation_id)) byReg.set(a.regulation_id, [])
    byReg.get(a.regulation_id)!.push({ control_key: a.control_key, status: a.status })
  }

  // Regulations with at least one non-default assessment
  const assessedRegIds = new Set(
    [...byReg.entries()]
      .filter(([, entries]) => entries.some(e => e.status !== 'not_assessed'))
      .map(([id]) => id)
  )

  // Historic state map: for each (regId:controlKey), earliest old_value in last 30 days
  // = what the status was before any changes in the window (i.e. the state 30 days ago)
  const historicMap = new Map<string, string>()
  for (const c of recentChanges) {
    const regId = c.details?.regulation_id
    if (!regId) continue
    const key = `${regId}:${c.entity_name}`
    if (!historicMap.has(key)) historicMap.set(key, c.old_value ?? 'not_assessed')
  }

  function computeHistoricScore(regId: string): number {
    const current = byReg.get(regId) ?? []
    let score = 0
    for (const ctrl of DLP_CONTROLS) {
      const histKey = `${regId}:${ctrl.key}`
      const status = historicMap.has(histKey)
        ? historicMap.get(histKey)!
        : (current.find(a => a.control_key === ctrl.key)?.status ?? 'not_assessed')
      if (status === 'implemented') score += 1
      if (status === 'partial')     score += 0.5
    }
    return Math.round((score / CONTROL_COUNT) * 100)
  }

  // Compute score per assessed regulation, with 30-day delta
  const regScores = regs
    .filter(r => assessedRegIds.has(r.id))
    .map(r => {
      const score   = computeScore(byReg.get(r.id) ?? [])
      const hasChange = [...historicMap.keys()].some(k => k.startsWith(r.id + ':'))
      const delta   = hasChange ? score - computeHistoricScore(r.id) : null
      return { id: r.id, code: r.code, short_name: r.short_name, score, delta, isRelevant: relevantIds.has(r.id) }
    })
    .sort((a, b) => a.score - b.score) // weakest first

  // Average over applicable regs (treating unassessed as 0 — can't claim compliance without assessment).
  // Falls back to assessed-only average when org profile is not set.
  const avgScore: number | null = (() => {
    if (relevantIds.size > 0) {
      const total = [...relevantIds].reduce((sum, id) => sum + computeScore(byReg.get(id) ?? []), 0)
      return Math.round(total / relevantIds.size)
    }
    if (regScores.length === 0) return null
    return Math.round(regScores.reduce((s, r) => s + r.score, 0) / regScores.length)
  })()

  // 30-day delta for the avg — only when applicable regs exist and at least one changed
  const scoreDelta: number | null = (() => {
    if (avgScore === null || relevantIds.size === 0) return null
    const anyChanged = [...relevantIds].some(id =>
      [...historicMap.keys()].some(k => k.startsWith(id + ':'))
    )
    if (!anyChanged) return null
    const historicTotal = [...relevantIds].reduce((sum, id) => sum + computeHistoricScore(id), 0)
    const historicAvg   = Math.round(historicTotal / relevantIds.size)
    return avgScore - historicAvg
  })()

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
        <h1 className="text-2xl font-bold text-foreground mb-1">Compliance</h1>
        <p className="text-muted-foreground/80 text-sm">
          Your organisation&apos;s DLP compliance posture across all tracked regulations.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border bg-card/40 px-5 py-4 shadow-sm">
          <div className="text-2xl font-bold text-foreground tabular-nums">{totalRegs}</div>
          <div className="text-xs text-muted-foreground/80 mt-0.5">Regulations tracked</div>
        </div>

        <div className="rounded-xl border border-border bg-card/40 px-5 py-4 shadow-sm">
          <div className="text-2xl font-bold text-foreground tabular-nums">
            {assessedCount}
            <span className="text-muted-foreground/60 text-base font-normal">/{totalRegs}</span>
          </div>
          <div className="text-xs text-muted-foreground/80 mt-0.5">Regulations assessed</div>
        </div>

        <div className="rounded-xl border border-border bg-card/40 px-5 py-4 shadow-sm">
          {avgScore !== null ? (
            <>
              <div className={cn(
                'text-2xl font-bold tabular-nums',
                avgScore >= 80 ? 'text-green-400' : avgScore >= 50 ? 'text-amber-400' : 'text-red-400'
              )}>
                {avgScore}%
              </div>
              <div className="text-xs text-muted-foreground/80 mt-0.5">Avg compliance score</div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] text-muted-foreground/60">
                  {relevantIds.size > 0
                    ? `Across ${relevantIds.size} applicable regs`
                    : `Avg of ${assessedCount} assessed`}
                </span>
                {scoreDelta !== null && scoreDelta !== 0 && (
                  <span className={cn(
                    'text-[10px] font-semibold tabular-nums',
                    scoreDelta > 0 ? 'text-green-400' : 'text-red-400'
                  )}>
                    {scoreDelta > 0 ? '+' : ''}{scoreDelta}pp
                  </span>
                )}
              </div>
              <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
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
              <div className="text-2xl font-bold text-muted-foreground/60">—</div>
              <div className="text-xs text-muted-foreground/80 mt-0.5">Avg compliance score</div>
              <div className="text-[10px] text-muted-foreground/60 mt-1">No assessments yet</div>
            </>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card/40 px-5 py-4 shadow-sm">
          <div className="text-2xl font-bold text-foreground tabular-nums">{relevantCount}</div>
          <div className="text-xs text-muted-foreground/80 mt-0.5">Apply to your org</div>
          {relevantCount === 0 && (
            <div className="text-[10px] text-muted-foreground/60 mt-1">Complete onboarding to see</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Regulation scores */}
        <div className="lg:col-span-3 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Regulation Scores</h2>
            <Link
              href="/compliance/gap-report"
              className="flex items-center gap-1 text-xs text-muted-foreground/80 hover:text-foreground/70 transition-colors"
            >
              Open Gap Report
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {regScores.length === 0 ? (
            <div className="rounded-xl border border-border bg-card/40 px-6 py-10 text-center shadow-sm">
              <BarChart2 className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground font-medium">No assessments yet</p>
              <p className="text-xs text-muted-foreground/60 mt-1 mb-4">
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
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-card/80">
                    <th className="text-left text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wide px-5 py-2.5">Regulation</th>
                    <th className="text-left text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wide px-4 py-2.5 w-40">Score</th>
                    <th className="w-10 px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {regScores.map(r => (
                    <tr key={r.id} className="hover:bg-card/40 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-foreground">{r.short_name}</span>
                          {r.isRelevant && (
                            <span className="text-[10px] px-1 py-0.5 rounded bg-blue-500/15 text-blue-400">your org</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className={cn(
                                'h-full rounded-full',
                                r.score >= 80 ? 'bg-green-500' : r.score >= 50 ? 'bg-amber-500' : 'bg-red-500'
                              )}
                              style={{ width: `${r.score}%` }}
                            />
                          </div>
                          <span className={cn(
                            'text-xs font-semibold tabular-nums w-8 text-right shrink-0',
                            r.score >= 80 ? 'text-green-400' : r.score >= 50 ? 'text-amber-400' : 'text-red-400'
                          )}>
                            {r.score}%
                          </span>
                          {r.delta !== null && r.delta !== 0 && (
                            <span className={cn(
                              'text-[10px] font-medium tabular-nums shrink-0 w-10 text-right',
                              r.delta > 0 ? 'text-green-500' : 'text-red-500'
                            )}>
                              {r.delta > 0 ? '+' : ''}{r.delta}pp
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/compliance/gap-report?reg=${r.code}`}
                          className="text-muted-foreground/60 hover:text-foreground/70 transition-colors"
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
                <div className="border-t border-border px-5 py-3 bg-card/60 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground/80">
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
            <h2 className="text-sm font-semibold text-foreground">Recent Activity</h2>
            <Link
              href="/compliance/audit-trail"
              className="flex items-center gap-1 text-xs text-muted-foreground/80 hover:text-foreground/70 transition-colors"
            >
              Full trail
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {logs.length === 0 ? (
            <div className="rounded-xl border border-border bg-card/40 px-6 py-10 text-center shadow-sm">
              <FileText className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground font-medium">No activity yet</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Assessment changes will appear here.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden divide-y divide-border/60">
              {logs.map(log => {
                const regName  = regNameMap.get(log.details?.regulation_id ?? '') ?? '—'
                const ctrlName = ctrlMap.get(log.entity_name) ?? log.entity_name
                const newStyle = log.new_value ? (STATUS_STYLE[log.new_value] ?? STATUS_STYLE.not_assessed) : STATUS_STYLE.not_assessed
                return (
                  <div key={log.id} className="px-4 py-3 hover:bg-card/40 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs text-foreground font-medium truncate">{ctrlName}</div>
                        <div className="text-[10px] text-muted-foreground/80 mt-0.5">{regName} · {log.user_email ?? 'unknown'}</div>
                      </div>
                      <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0', newStyle.color, newStyle.bg)}>
                        {newStyle.label}
                      </span>
                    </div>
                    <div className="text-[10px] text-muted-foreground/60 mt-1">{formatDate(log.created_at)}</div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Quick links */}
          <div className="rounded-xl border border-border bg-card/40 overflow-hidden divide-y divide-border/60 shadow-sm">
            {[
              { href: '/compliance/regulations', icon: FileText,       label: 'Regulations & Frameworks', sub: `${totalRegs} tracked` },
              { href: '/compliance/gap-report',  icon: ClipboardCheck, label: 'Gap Report',           sub: `${assessedCount} assessed` },
              { href: '/compliance/audit-trail', icon: BarChart2,      label: 'Audit Trail',          sub: `${logs.length > 0 ? 'Recent activity' : 'No activity yet'}` },
            ].map(({ href, icon: Icon, label, sub }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 px-4 py-3 hover:bg-card/60 transition-colors group"
              >
                <Icon className="h-4 w-4 text-muted-foreground/60 group-hover:text-muted-foreground transition-colors shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-foreground">{label}</div>
                  <div className="text-[10px] text-muted-foreground/60">{sub}</div>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-muted-foreground/80 transition-colors" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
