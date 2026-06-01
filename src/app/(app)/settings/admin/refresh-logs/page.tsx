import { requireRole } from '@/lib/auth'
import { callData } from '@/lib/api-client.server'
import { cn } from '@/lib/utils'
import { CheckCircle2, XCircle, Loader2, AlertTriangle, Clock, GitCompare } from 'lucide-react'

interface FieldChange {
  app_id: string
  app_name: string
  field: string
  old_value: string
  new_value: string
}

interface ResearchRun {
  id: string
  started_at: string
  completed_at: string | null
  apps_updated: number
  apps_added: number
  errors: Array<{ app_id?: string; error: string }>
  changes: FieldChange[]
  status: 'running' | 'completed' | 'failed' | 'partial' | 'timed_out'
}

function duration(started: string, completed: string | null): string {
  if (!completed) return '—'
  const ms = new Date(completed).getTime() - new Date(started).getTime()
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${s % 60}s`
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function StatusBadge({ status }: { status: ResearchRun['status'] }) {
  if (status === 'completed') return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/20">
      <CheckCircle2 className="w-3 h-3" />Completed
    </span>
  )
  if (status === 'failed') return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/20">
      <XCircle className="w-3 h-3" />Failed
    </span>
  )
  if (status === 'partial') return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/20">
      <AlertTriangle className="w-3 h-3" />Partial
    </span>
  )
  if (status === 'timed_out') return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted/60 text-muted-foreground border border-border">
      <Clock className="w-3 h-3" />Timed Out
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 border border-yellow-500/20">
      <Loader2 className="w-3 h-3 animate-spin" />Running
    </span>
  )
}

function FieldLabel({ field }: { field: string }) {
  return (
    <span className={cn(
      'font-mono text-[10px] px-1.5 py-0.5 rounded',
      field.startsWith('dlp.') ? 'bg-blue-500/10 text-blue-400' : 'bg-muted text-muted-foreground',
    )}>
      {field.replace('dlp.', '').replace(/_/g, ' ')}
    </span>
  )
}

export default async function RefreshLogsPage() {
  await requireRole('analyst')

  const allRuns: ResearchRun[] = await callData<ResearchRun[]>('/api/data/genai-research-runs').catch(() => [])
  const lastRun = allRuns[0] ?? null
  const totalChanges = allRuns.reduce((s, r) => s + (r.changes?.length ?? 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Research Run Logs</h1>
          <p className="text-sm text-muted-foreground/80 mt-1">
            Weekly auto-refresh — discovers new apps, re-evaluates all profiles, logs field changes.
            Runs every <span className="font-medium text-foreground/80">Monday 02:00 UTC</span> via Vercel cron.
          </p>
        </div>
        {lastRun && (
          <div className="text-right shrink-0">
            <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wide mb-1">Last run</p>
            <StatusBadge status={lastRun.status} />
            <p className="text-xs text-muted-foreground/80 mt-1">{timeAgo(lastRun.started_at)}</p>
          </div>
        )}
      </div>

      {/* How it works callout */}
      <div className="rounded-xl border border-border bg-card/30 px-5 py-4 space-y-2">
        <p className="text-xs font-semibold text-foreground/80">How the auto-refresh works</p>
        <ol className="text-xs text-muted-foreground/80 space-y-1 list-decimal list-inside">
          <li>Vercel cron triggers <code className="text-foreground/70 bg-muted px-1 rounded">GET /api/genai-refresh</code> every Monday at 02:00 UTC</li>
          <li>Claude identifies up to 5 new GenAI applications not yet in the catalog and inserts them into <code className="text-foreground/70 bg-muted px-1 rounded">genai_apps</code></li>
          <li>For every app in the catalog, Claude researches the enterprise security profile (32 fields + 7 DLP activities + breach info) and upserts to <code className="text-foreground/70 bg-muted px-1 rounded">genai_app_profiles</code></li>
          <li>Field changes from the previous run are diffed and stored in <code className="text-foreground/70 bg-muted px-1 rounded">genai_research_runs.changes</code> — shown below</li>
          <li>Apps in the catalog without a full profile are <strong className="text-foreground/70">not shown</strong> in the App Catalog until their evaluation completes</li>
        </ol>
      </div>

      {/* Summary stats */}
      {allRuns.length > 0 && (
        <div className="grid grid-cols-5 gap-3">
          {[
            { label: 'Total Runs',      value: allRuns.length },
            { label: 'Successful',      value: allRuns.filter(r => r.status === 'completed').length },
            { label: 'Failed',          value: allRuns.filter(r => r.status === 'failed').length },
            { label: 'Apps Discovered', value: allRuns.reduce((s, r) => s + r.apps_added, 0) },
            { label: 'Field Changes',   value: totalChanges },
          ].map(stat => (
            <div key={stat.label} className="rounded-xl border border-border bg-card/50 p-3 shadow-sm">
              <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wide mb-1">{stat.label}</p>
              <p className="text-xl font-bold text-foreground">{stat.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Runs table */}
      {allRuns.length === 0 ? (
        <div className="rounded-xl border border-border bg-card/50 py-16 text-center shadow-sm">
          <Clock className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground/80">No research runs yet.</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Runs every Monday 02:00 UTC.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-card/80">
                <th className="text-left text-[10px] font-semibold text-muted-foreground/80 uppercase tracking-wide px-4 py-3">Started</th>
                <th className="text-left text-[10px] font-semibold text-muted-foreground/80 uppercase tracking-wide px-4 py-3">Status</th>
                <th className="text-center text-[10px] font-semibold text-muted-foreground/80 uppercase tracking-wide px-4 py-3">Updated</th>
                <th className="text-center text-[10px] font-semibold text-muted-foreground/80 uppercase tracking-wide px-4 py-3">Added</th>
                <th className="text-center text-[10px] font-semibold text-muted-foreground/80 uppercase tracking-wide px-4 py-3">Duration</th>
                <th className="text-center text-[10px] font-semibold text-muted-foreground/80 uppercase tracking-wide px-4 py-3">Changes</th>
                <th className="text-center text-[10px] font-semibold text-muted-foreground/80 uppercase tracking-wide px-4 py-3">Errors</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {allRuns.map((run) => {
                const hasChanges = run.changes?.length > 0
                const hasErrors  = run.errors?.length > 0
                return (
                  <>
                    <tr key={run.id} className={cn('transition-colors', (hasChanges || hasErrors) ? 'bg-card/20' : 'hover:bg-card/40')}>
                      <td className="px-4 py-3">
                        <p className="text-foreground text-xs font-medium">
                          {new Date(run.started_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                        <p className="text-[10px] text-muted-foreground/60 mt-0.5">{timeAgo(run.started_at)}</p>
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={run.status} /></td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-sm font-semibold text-foreground">{run.apps_updated}</span>
                        <span className="text-[10px] text-muted-foreground/60 ml-1">apps</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {run.apps_added > 0 ? (
                          <span className="text-xs font-semibold text-blue-400">+{run.apps_added}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground/60">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-xs text-muted-foreground tabular-nums">{duration(run.started_at, run.completed_at)}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {hasChanges ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-400">
                            <GitCompare className="w-3 h-3" />{run.changes.length}
                          </span>
                        ) : <span className="text-xs text-muted-foreground/60">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {hasErrors ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-500/15 text-red-400">
                            <AlertTriangle className="w-3 h-3" />{run.errors.length}
                          </span>
                        ) : <span className="text-xs text-muted-foreground/60">—</span>}
                      </td>
                    </tr>

                    {hasChanges && (
                      <tr key={`${run.id}-changes`} className="bg-purple-950/10 border-t border-purple-900/20">
                        <td colSpan={7} className="px-4 py-3">
                          <p className="text-[10px] font-semibold text-purple-400 uppercase tracking-wide mb-2">Field Changes Detected</p>
                          <div className="space-y-1.5">
                            {run.changes.map((change, i) => (
                              <div key={i} className="flex items-center gap-2 text-[11px]">
                                <span className="text-muted-foreground/80 w-32 truncate shrink-0">{change.app_name}</span>
                                <FieldLabel field={change.field} />
                                <span className="text-red-400/80 line-through">{change.old_value}</span>
                                <span className="text-muted-foreground/60">→</span>
                                <span className="text-green-400">{change.new_value}</span>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}

                    {hasErrors && (
                      <tr key={`${run.id}-errors`} className="bg-red-950/10 border-t border-red-900/20">
                        <td colSpan={7} className="px-4 py-3">
                          <p className="text-[10px] font-semibold text-red-400 uppercase tracking-wide mb-2">Errors</p>
                          <div className="space-y-1">
                            {run.errors.map((err, i) => (
                              <div key={i} className="flex items-start gap-2 text-[11px]">
                                <span className="font-mono text-red-500/60 shrink-0 w-32 truncate">{err.app_id ?? 'system'}</span>
                                <span className="text-muted-foreground/80">{err.error}</span>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
