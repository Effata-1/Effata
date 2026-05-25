import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { computeTrustScore } from '@/lib/genai/scoring'
import type { AppFields, DLPActivities, BreachInfo, ApprovalStatus } from '@/lib/genai/types'
import { StatCard } from './_components/stat-card'
import { CategoryBreakdown } from './_components/category-breakdown'
import type { CategoryItem } from './_components/category-breakdown'
import { ApprovalStatusRow } from './_components/approval-status-row'
import { TrustScoreSummary } from './_components/trust-score-summary'
import { ResearchStatus } from './_components/research-status'

export default async function GenAIDashboardPage() {
  const supabase = await createClient()

  const sessionResult = await supabase.auth.getSession()
  const orgId: string | null = sessionResult.data.session?.access_token
    ? (JSON.parse(atob(sessionResult.data.session.access_token.split('.')[1]))?.org_id ?? null)
    : null

  const today = new Date().toISOString().split('T')[0]

  const [
    totalAppsResult,
    classResult,
    categoryResult,
    profileResult,
    lastRunResult,
  ] = await Promise.all([
    supabase.from('genai_apps').select('*', { count: 'exact', head: true }),
    orgId
      ? supabase.from('genai_customer_classifications')
          .select('customer_classification, approval_status, next_review_date')
          .eq('org_id', orgId)
      : Promise.resolve({ data: [] as Array<{ customer_classification: string; approval_status: string | null; next_review_date: string | null }> }),
    orgId
      ? supabase.from('org_genai_governance_categories')
          .select('id, system_tag, name, color')
          .eq('org_id', orgId)
          .eq('active', true)
          .order('priority')
      : Promise.resolve({ data: [] as Array<{ id: string; system_tag: string | null; name: string; color: string }> }),
    supabase.from('genai_app_profiles').select('app_id, fields, dlp, breach_info'),
    supabase.from('genai_research_runs')
      .select('created_at, status')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const totalApps   = totalAppsResult.count ?? 0
  const clsRows     = classResult.data ?? []
  const categories  = categoryResult.data ?? []
  const profileRows = profileResult.data ?? []
  const lastRun     = lastRunResult.data

  // ── Category breakdown ────────────────────────────────────────
  const categoryCounts = new Map<string, number>()
  for (const row of clsRows) {
    const key = row.customer_classification
    categoryCounts.set(key, (categoryCounts.get(key) ?? 0) + 1)
  }

  const categoryBreakdown: CategoryItem[] = [
    ...categories.map(c => ({
      key:   c.system_tag ?? c.id,
      name:  c.name,
      color: c.color,
      count: categoryCounts.get(c.system_tag ?? c.id) ?? 0,
    })),
    { key: 'unknown', name: 'Unknown', color: 'zinc', count: categoryCounts.get('unknown') ?? 0 },
  ]

  // ── Approval status breakdown ─────────────────────────────────
  const approvalCounts: Record<ApprovalStatus, number> = {
    approved: 0, 'under-review': 0, draft: 0, rejected: 0, expired: 0,
  }
  for (const row of clsRows) {
    const status = (row.approval_status ?? 'draft') as ApprovalStatus
    if (status in approvalCounts) approvalCounts[status]++
  }

  // ── Apps needing review ───────────────────────────────────────
  const needsReviewCount = clsRows.filter(r =>
    !r.next_review_date || r.next_review_date <= today
  ).length

  // ── Trust score distribution ──────────────────────────────────
  const scores: number[] = []
  for (const p of profileRows) {
    try {
      const s = computeTrustScore(
        p.fields as unknown as AppFields,
        p.dlp as unknown as DLPActivities,
        p.breach_info as unknown as BreachInfo,
      )
      scores.push(s.final_score)
    } catch {
      // skip profiles with missing data
    }
  }

  const avgScore  = scores.length > 0
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : null
  const highRisk  = scores.filter(s => s < 40).length
  const medRisk   = scores.filter(s => s >= 40 && s < 70).length
  const lowRisk   = scores.filter(s => s >= 70).length

  const avgAccent: 'green' | 'amber' | 'red' | undefined =
    avgScore === null ? undefined : avgScore >= 70 ? 'green' : avgScore >= 40 ? 'amber' : 'red'

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-xl font-bold text-foreground">GenAI Dashboard</h1>
        <p className="text-sm text-muted-foreground/70 mt-0.5">
          At-a-glance view of your organisation&apos;s GenAI governance posture
        </p>
      </div>

      {/* Top stat row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          label="Total Apps"
          value={totalApps}
          sub="in catalog"
        />
        <StatCard
          label="Approved"
          value={approvalCounts.approved}
          sub="governance approved"
          accent={approvalCounts.approved > 0 ? 'emerald' : undefined}
        />
        <StatCard
          label="Avg Trust Score"
          value={avgScore !== null ? avgScore : '—'}
          sub={avgScore !== null ? 'across all profiles' : 'no profiles yet'}
          accent={avgAccent}
        />
        <StatCard
          label="Needs Review"
          value={needsReviewCount}
          sub={<Link href="/genai-controls/apps" className="hover:underline">view apps →</Link>}
          accent={needsReviewCount > 0 ? 'amber' : undefined}
        />
      </div>

      {/* Category breakdown */}
      <div className="rounded-xl border border-border bg-card/50 shadow-sm p-5">
        <p className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wide mb-4">
          Apps by Governance Category
        </p>
        <CategoryBreakdown items={categoryBreakdown} />
      </div>

      {/* Approval status + trust score */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card/50 shadow-sm p-5">
          <p className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wide mb-4">
            Approval Status
          </p>
          <ApprovalStatusRow counts={approvalCounts} />
        </div>
        <div className="rounded-xl border border-border bg-card/50 shadow-sm p-5">
          <p className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wide mb-4">
            Trust Score Distribution
          </p>
          <TrustScoreSummary
            avg={avgScore}
            high={highRisk}
            medium={medRisk}
            low={lowRisk}
            total={scores.length}
          />
        </div>
      </div>

      {/* Research run + placeholder tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-card/50 shadow-sm p-5">
          <p className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wide mb-4">
            Last Research Run
          </p>
          <ResearchStatus run={lastRun} />
        </div>
        <div className="rounded-xl border border-border bg-card/30 shadow-sm p-5 flex flex-col justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wide mb-1">
              Sensitive Data Events
            </p>
            <p className="text-xs text-muted-foreground/50">
              Incident tracking coming in a future release.
            </p>
          </div>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded border border-border text-muted-foreground/50 self-start">
            Coming soon
          </span>
        </div>
        <div className="rounded-xl border border-border bg-card/30 shadow-sm p-5 flex flex-col justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wide mb-1">
              Prohibited App Attempts
            </p>
            <p className="text-xs text-muted-foreground/50">
              Activity log tracking coming in a future release.
            </p>
          </div>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded border border-border text-muted-foreground/50 self-start">
            Coming soon
          </span>
        </div>
      </div>
    </div>
  )
}
