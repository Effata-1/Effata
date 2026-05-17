import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

interface CronRun {
  id: string
  type: 'compliance' | 'genai'
  started_at: string
  completed_at: string | null
  status: string
  summary: string
  changes: Array<{
    regulation_code?: string
    regulation_name?: string
    app_id?: string
    reason?: string
    fields_updated?: string[]
  }>
  errors: Array<{ regulation_code?: string; app_id?: string; error: string }>
}

const STATUS_COLORS: Record<string, string> = {
  completed: 'text-green-400',
  running:   'text-blue-400',
  failed:    'text-red-400',
}

const TYPE_COLORS: Record<string, string> = {
  compliance: 'bg-teal-500/10 text-teal-400',
  genai:      'bg-purple-500/10 text-purple-400',
}

const TYPE_LABELS: Record<string, string> = {
  compliance: 'Compliance',
  genai:      'GenAI Research',
}

function dur(start: string, end: string | null) {
  if (!end) return '—'
  const s = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000)
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export default async function CronRunsPage() {
  const supabase = await createClient()

  const [{ data: cd }, { data: gd }] = await Promise.all([
    supabase.from('compliance_check_runs').select('*').order('started_at', { ascending: false }).limit(20),
    supabase.from('genai_research_runs').select('*').order('started_at', { ascending: false }).limit(20),
  ])

  const compliance: CronRun[] = ((cd ?? []) as Array<Record<string, unknown>>).map(r => ({
    id:           r.id as string,
    type:         'compliance',
    started_at:   r.started_at as string,
    completed_at: r.completed_at as string | null,
    status:       r.status as string,
    summary:      `${r.regs_checked ?? 0} checked · ${r.regs_updated ?? 0} updated · ${r.regs_added ?? 0} added`,
    changes:      (r.changes as CronRun['changes']) ?? [],
    errors:       (r.errors as CronRun['errors']) ?? [],
  }))

  const genai: CronRun[] = ((gd ?? []) as Array<Record<string, unknown>>).map(r => ({
    id:           r.id as string,
    type:         'genai',
    started_at:   r.started_at as string,
    completed_at: r.completed_at as string | null,
    status:       r.status as string,
    summary:      `${r.apps_updated ?? 0} apps updated · ${r.apps_added ?? 0} added`,
    changes:      [],
    errors:       (r.errors as CronRun['errors']) ?? [],
  }))

  const runs = [...compliance, ...genai].sort(
    (a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
  )

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white mb-1">Cron Job Runs</h2>
        <p className="text-sm text-zinc-500">
          All scheduled background jobs. Compliance review runs on the 1st of each month · GenAI research runs every Monday.
        </p>
      </div>

      {runs.length === 0 ? (
        <div className="py-16 text-center rounded-xl border border-zinc-800">
          <p className="text-sm text-zinc-500">No runs recorded yet.</p>
          <p className="text-xs text-zinc-600 mt-1">Jobs run automatically on their schedule.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-800 overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[140px_100px_1fr_80px_80px] gap-4 px-5 py-2.5 border-b border-zinc-800">
            {['Job', 'Status', 'Started', 'Duration', 'Result'].map(h => (
              <span key={h} className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wide">{h}</span>
            ))}
          </div>

          {/* Rows */}
          <div className="divide-y divide-zinc-800/60">
            {runs.map(run => (
              <details key={run.id} className="group">
                <summary className="grid grid-cols-[140px_100px_1fr_80px_80px] gap-4 px-5 py-3.5 cursor-pointer hover:bg-zinc-900/40 transition-colors list-none">
                  <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded uppercase self-center w-fit', TYPE_COLORS[run.type])}>
                    {TYPE_LABELS[run.type]}
                  </span>
                  <span className={cn('text-xs font-medium self-center', STATUS_COLORS[run.status] ?? 'text-zinc-400')}>
                    {run.status}
                  </span>
                  <span className="text-xs text-zinc-300 self-center">{fmt(run.started_at)}</span>
                  <span className="text-xs text-zinc-500 self-center">{dur(run.started_at, run.completed_at)}</span>
                  <span className="text-xs text-zinc-400 self-center">{run.summary}</span>
                </summary>

                {/* Expanded detail */}
                {(run.changes.length > 0 || run.errors.length > 0) && (
                  <div className="px-5 pb-4 pt-1 space-y-3 bg-zinc-900/30">
                    {run.changes.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wide mb-2">Changes</p>
                        <div className="space-y-1.5">
                          {run.changes.map((c, i) => (
                            <div key={i} className="flex items-start gap-2.5">
                              <span className="text-[10px] font-mono bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded uppercase shrink-0">
                                {c.regulation_code ?? c.app_id ?? '—'}
                              </span>
                              <div>
                                {c.regulation_name && <p className="text-xs text-zinc-300">{c.regulation_name}</p>}
                                {c.reason && <p className="text-xs text-zinc-500">{c.reason}</p>}
                                {c.fields_updated?.length && (
                                  <p className="text-[10px] text-zinc-600">Fields: {c.fields_updated.join(', ')}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {run.errors.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wide mb-2">Errors</p>
                        <div className="space-y-1">
                          {run.errors.map((e, i) => (
                            <div key={i} className="flex items-start gap-2">
                              {(e.regulation_code ?? e.app_id) && (
                                <span className="text-[10px] font-mono bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded shrink-0">
                                  {e.regulation_code ?? e.app_id}
                                </span>
                              )}
                              <p className="text-xs text-red-400">{e.error}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </details>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
