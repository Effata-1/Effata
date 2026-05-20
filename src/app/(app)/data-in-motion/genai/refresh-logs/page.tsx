import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase/service'
import { cn } from '@/lib/utils'
import { ArrowLeft, CheckCircle2, XCircle, Loader2, AlertTriangle, Clock, GitCompare } from 'lucide-react'

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
  status: 'running' | 'completed' | 'failed'
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
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 border border-yellow-500/20">
      <Loader2 className="w-3 h-3 animate-spin" />Running
    </span>
  )
}

function FieldLabel({ field }: { field: string }) {
  const name = field.replace('dlp.', '').replace(/_/g, ' ')
  return (
    <span className={cn(
      'font-mono text-[10px] px-1.5 py-0.5 rounded',
      field.startsWith('dlp.') ? 'bg-blue-500/10 text-blue-400' : 'bg-muted text-muted-foreground'
    )}>
      {name}
    </span>
  )
}

export default async function RefreshLogsPage() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return (
      <div className="space-y-6">
        <div>
          <Link href="/data-in-motion/genai" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground/80 hover:text-foreground/70 transition-colors mb-2">
            <ArrowLeft className="w-3 h-3" />Back to GenAI Apps
          </Link>
          <h1 className="text-xl font-bold text-foreground">Research Run Logs</h1>
        </div>
        <div className="rounded-xl border border-border bg-card/50 py-16 text-center shadow-sm">
          <Clock className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-foreground font-medium mb-1">Service key not configured</p>
          <p className="text-xs text-muted-foreground/80 max-w-sm mx-auto">
            Add <code className="text-foreground/70 bg-muted px-1 rounded">SUPABASE_SERVICE_ROLE_KEY</code> to your
            Vercel environment variables and redeploy to enable research run logs.
          </p>
        </div>
      </div>
    )
  }

  const supabase = createServiceClient()

  const { data: runs } = await supabase
    .from('genai_research_runs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(50)

  const allRuns = (runs as ResearchRun[] ?? [])
  const lastRun = allRuns[0] ?? null
  const totalRuns = allRuns.length
  const successCount = allRuns.filter(r => r.status === 'completed').length
  const totalChanges = allRuns.reduce((s, r) => s + (r.changes?.length ?? 0), 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/data-in-motion/genai"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground/80 hover:text-foreground/70 transition-colors mb-2"
          >
            <ArrowLeft className="w-3 h-3" />Back to GenAI Apps
          </Link>
          <h1 className="text-xl font-bold text-foreground">Research Run Logs</h1>
          <p className="text-sm text-muted-foreground/80 mt-1">
            Weekly auto-refresh — discovers new apps, refreshes all profiles, detects field changes. Runs every Monday 02:00 UTC.
          </p>
        </div>
        {lastRun && (
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wide mb-1">Last run</p>
            <StatusBadge status={lastRun.status} />
            <p className="text-xs text-muted-foreground/80 mt-1">{timeAgo(lastRun.started_at)}</p>
          </div>
        )}
      </div>

      {/* Summary stats */}
      {totalRuns > 0 && (
        <div className="grid grid-cols-5 gap-3">
          {[
            { label: 'Total Runs',        value: totalRuns },
            { label: 'Successful',        value: successCount },
            { label: 'Failed',            value: allRuns.filter(r => r.status === 'failed').length },
            { label: 'Apps Discovered',   value: allRuns.reduce((s, r) => s + r.apps_added, 0) },
            { label: 'Field Changes',     value: totalChanges },
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
          <p className="text-xs text-muted-foreground/60 mt-1">
            Runs every Monday 02:00 UTC, or trigger manually via the API.
          </p>
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
                const hasDetail  = hasChanges || hasErrors
                return (
                  <>
                    <tr key={run.id} className={cn(
                      'transition-colors',
                      hasDetail ? 'bg-card/20' : 'hover:bg-card/40'
                    )}>
                      <td className="px-4 py-3">
                        <p className="text-foreground text-xs font-medium">
                          {new Date(run.started_at).toLocaleDateString('en-GB', {
                            day: '2-digit', month: 'short', year: 'numeric',
                            hour: '2-digit', minute: '2-digit',
                          })}
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
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {duration(run.started_at, run.completed_at)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {hasChanges ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-400">
                            <GitCompare className="w-3 h-3" />{run.changes.length}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground/60">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {hasErrors ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-500/15 text-red-400">
                            <AlertTriangle className="w-3 h-3" />{run.errors.length}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground/60">—</span>
                        )}
                      </td>
                    </tr>

                    {/* Field changes detail */}
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

                    {/* Error detail rows */}
                    {hasErrors && (
                      <tr key={`${run.id}-errors`} className="bg-red-950/10 border-t border-red-900/20">
                        <td colSpan={7} className="px-4 py-3">
                          <p className="text-[10px] font-semibold text-red-400 uppercase tracking-wide mb-2">Errors</p>
                          <div className="space-y-1">
                            {run.errors.map((err, i) => (
                              <div key={i} className="flex items-start gap-2 text-[11px]">
                                <span className="font-mono text-red-500/60 shrink-0 w-32 truncate">
                                  {err.app_id ?? 'system'}
                                </span>
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
