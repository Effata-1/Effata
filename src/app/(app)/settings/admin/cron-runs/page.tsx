import { createClient } from '@/lib/supabase/server'
import { TriggerButton } from './_components/trigger-button'
import { RunsList } from './_components/runs-list'
import type { UnifiedRun } from './_components/runs-list'

export const dynamic = 'force-dynamic'

export default async function CronRunsPage() {
  const supabase = await createClient()

  const [{ data: complianceData }, { data: genaiData }] = await Promise.all([
    supabase
      .from('compliance_check_runs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(25),
    supabase
      .from('genai_research_runs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(25),
  ])

  const complianceRuns: UnifiedRun[] = ((complianceData ?? []) as Array<Record<string, unknown>>).map(r => ({
    id:           r.id as string,
    type:         'compliance',
    started_at:   r.started_at as string,
    completed_at: r.completed_at as string | null,
    status:       r.status as string,
    summary:      `${r.regs_checked ?? 0} regulations checked, ${r.regs_updated ?? 0} updated`,
    changes:      (r.changes as UnifiedRun['changes']) ?? [],
    errors:       (r.errors as UnifiedRun['errors']) ?? [],
  }))

  const genaiRuns: UnifiedRun[] = ((genaiData ?? []) as Array<Record<string, unknown>>).map(r => ({
    id:           r.id as string,
    type:         'genai',
    started_at:   r.started_at as string,
    completed_at: r.completed_at as string | null,
    status:       r.status as string,
    summary:      `${r.apps_updated ?? 0} apps updated, ${r.apps_added ?? 0} added`,
    changes:      [],
    errors:       (r.errors as UnifiedRun['errors']) ?? [],
  }))

  const runs = [...complianceRuns, ...genaiRuns].sort(
    (a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
  )

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white mb-1">Cron Job Runs</h2>
          <p className="text-sm text-zinc-500">
            All scheduled background jobs — GenAI research and compliance review run every Monday.
          </p>
        </div>
        <TriggerButton />
      </div>

      <RunsList runs={runs} />
    </div>
  )
}
