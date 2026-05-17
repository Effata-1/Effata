import { cn } from '@/lib/utils'
import type { CronRun } from '../page'

const STATUS_STYLES: Record<string, string> = {
  completed: 'bg-green-500/15 text-green-400',
  running:   'bg-blue-500/15 text-blue-400',
  failed:    'bg-red-500/15 text-red-400',
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

export function RunsList({ runs }: { runs: CronRun[] }) {
  if (runs.length === 0) {
    return (
      <div className="py-16 text-center rounded-xl border border-zinc-800">
        <p className="text-sm text-zinc-500">No runs yet.</p>
        <p className="text-xs text-zinc-600 mt-1">
          The cron fires every Monday at 3 AM UTC, or use the button above to run it now.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {runs.map(run => (
        <div key={run.id} className="rounded-xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
          <div className="px-5 py-4 flex items-center gap-4 flex-wrap">
            <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded uppercase', STATUS_STYLES[run.status] ?? 'bg-zinc-700 text-zinc-400')}>
              {run.status}
            </span>
            <span className="text-sm font-medium text-white">{fmt(run.started_at)}</span>
            <span className="text-xs text-zinc-500">Duration: {duration(run.started_at, run.completed_at)}</span>
            <div className="ml-auto flex items-center gap-4 text-xs">
              <span className="text-zinc-400">{run.regs_checked} checked</span>
              <span className={run.regs_updated > 0 ? 'text-amber-400 font-medium' : 'text-zinc-600'}>
                {run.regs_updated} updated
              </span>
              {run.errors?.length > 0 && (
                <span className="text-red-400">{run.errors.length} errors</span>
              )}
            </div>
          </div>

          {run.changes?.length > 0 && (
            <div className="border-t border-zinc-800 px-5 py-3 space-y-2">
              <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wide mb-2">Changes made</p>
              {run.changes.map((c, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="text-[10px] font-mono bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded uppercase shrink-0">{c.regulation_code}</span>
                  <div>
                    <p className="text-xs text-zinc-300">{c.regulation_name}</p>
                    <p className="text-xs text-zinc-500">{c.reason}</p>
                    <p className="text-[10px] text-zinc-600 mt-0.5">Fields: {c.fields_updated.join(', ')}</p>
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
                  {e.regulation_code && (
                    <span className="text-[10px] font-mono bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded uppercase shrink-0">{e.regulation_code}</span>
                  )}
                  <p className="text-xs text-red-400">{e.error}</p>
                </div>
              ))}
            </div>
          )}

          {run.status === 'completed' && run.regs_updated === 0 && run.errors?.length === 0 && (
            <div className="border-t border-zinc-800 px-5 py-3">
              <p className="text-xs text-zinc-600">All {run.regs_checked} regulations verified — no factual changes detected.</p>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
