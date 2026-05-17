import { cn } from '@/lib/utils'

export interface UnifiedRun {
  id: string
  type: 'compliance' | 'genai'
  started_at: string
  completed_at: string | null
  status: string
  summary: string
  changes: Array<{
    regulation_code?: string
    regulation_name?: string
    reason?: string
    fields_updated?: string[]
  }>
  errors: Array<{
    regulation_code?: string
    app_id?: string
    error: string
  }>
}

const STATUS_STYLES: Record<string, string> = {
  completed: 'bg-green-500/15 text-green-400',
  running:   'bg-blue-500/15 text-blue-400',
  failed:    'bg-red-500/15 text-red-400',
}

const TYPE_STYLES: Record<string, string> = {
  compliance: 'bg-teal-500/15 text-teal-400',
  genai:      'bg-purple-500/15 text-purple-400',
}

const TYPE_LABELS: Record<string, string> = {
  compliance: 'Compliance Check',
  genai:      'GenAI Research',
}

function duration(start: string, end: string | null): string {
  if (!end) return 'running…'
  const ms = new Date(end).getTime() - new Date(start).getTime()
  const s = Math.round(ms / 1000)
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`
}

function fmt(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export function RunsList({ runs }: { runs: UnifiedRun[] }) {
  if (runs.length === 0) {
    return (
      <div className="py-16 text-center rounded-xl border border-zinc-800">
        <p className="text-sm text-zinc-500">No runs yet.</p>
        <p className="text-xs text-zinc-600 mt-1">
          Cron jobs fire every Monday at 3 AM UTC, or use the button above to trigger a compliance check now.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {runs.map(run => (
        <div key={run.id} className="rounded-xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
          <div className="px-5 py-4 flex items-center gap-3 flex-wrap">
            <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded uppercase', TYPE_STYLES[run.type])}>
              {TYPE_LABELS[run.type]}
            </span>
            <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded uppercase', STATUS_STYLES[run.status] ?? 'bg-zinc-700 text-zinc-400')}>
              {run.status}
            </span>
            <span className="text-sm font-medium text-white">{fmt(run.started_at)}</span>
            <span className="text-xs text-zinc-500">Duration: {duration(run.started_at, run.completed_at)}</span>
            <div className="ml-auto flex items-center gap-4 text-xs">
              <span className="text-zinc-400">{run.summary}</span>
              {run.errors?.length > 0 && (
                <span className="text-red-400">{run.errors.length} error{run.errors.length !== 1 ? 's' : ''}</span>
              )}
            </div>
          </div>

          {run.changes?.length > 0 && (
            <div className="border-t border-zinc-800 px-5 py-3 space-y-2">
              <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wide mb-2">Changes made</p>
              {run.changes.map((c, i) => (
                <div key={i} className="flex items-start gap-3">
                  {c.regulation_code && (
                    <span className="text-[10px] font-mono bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded uppercase shrink-0">
                      {c.regulation_code}
                    </span>
                  )}
                  <div>
                    {c.regulation_name && <p className="text-xs text-zinc-300">{c.regulation_name}</p>}
                    {c.reason && <p className="text-xs text-zinc-500">{c.reason}</p>}
                    {c.fields_updated?.length && (
                      <p className="text-[10px] text-zinc-600 mt-0.5">Fields: {c.fields_updated.join(', ')}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {run.errors?.length > 0 && (
            <div className="border-t border-zinc-800 px-5 py-3 space-y-1.5">
              <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wide mb-2">Errors</p>
              {run.errors.map((e, i) => (
                <div key={i} className="flex items-start gap-2">
                  {(e.regulation_code || e.app_id) && (
                    <span className="text-[10px] font-mono bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded shrink-0">
                      {e.regulation_code ?? e.app_id}
                    </span>
                  )}
                  <p className="text-xs text-red-400">{e.error}</p>
                </div>
              ))}
            </div>
          )}

          {run.status === 'completed' && run.changes?.length === 0 && run.errors?.length === 0 && (
            <div className="border-t border-zinc-800 px-5 py-3">
              <p className="text-xs text-zinc-600">Completed — no changes detected.</p>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
