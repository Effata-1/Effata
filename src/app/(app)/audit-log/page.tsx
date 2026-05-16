import { createClient } from '@/lib/supabase/server'
import { CLASSIFICATION_LABELS } from '@/lib/genai/scoring'
import { cn } from '@/lib/utils'
import { Activity } from 'lucide-react'

interface AuditLog {
  id: string
  user_email: string | null
  action: string
  entity_type: string | null
  entity_id: string | null
  entity_name: string | null
  old_value: string | null
  new_value: string | null
  created_at: string
}

const ACTION_LABELS: Record<string, string> = {
  classification_changed: 'changed classification for',
}

function ClassBadge({ value }: { value: string | null }) {
  if (!value) return <span className="text-zinc-600">—</span>
  const meta = CLASSIFICATION_LABELS[value]
  if (!meta) return <span className="text-zinc-400 text-[10px]">{value}</span>
  return (
    <span className={cn(
      'text-[10px] font-bold px-1.5 py-0.5 rounded',
      meta.color === 'green'  ? 'bg-green-500/15 text-green-400'   :
      meta.color === 'red'    ? 'bg-red-500/15 text-red-400'       :
      meta.color === 'amber'  ? 'bg-yellow-500/15 text-yellow-400' :
      meta.color === 'blue'   ? 'bg-blue-500/15 text-blue-400'     :
      meta.color === 'purple' ? 'bg-purple-500/15 text-purple-400' :
      'bg-zinc-700/50 text-zinc-400'
    )}>{meta.label}</span>
  )
}

function groupByDate(logs: AuditLog[]): Array<{ label: string; logs: AuditLog[] }> {
  const groups: Record<string, AuditLog[]> = {}
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  for (const log of logs) {
    const d = new Date(log.created_at)
    d.setHours(0, 0, 0, 0)
    let label: string
    if (d.getTime() === today.getTime()) {
      label = 'Today'
    } else if (d.getTime() === yesterday.getTime()) {
      label = 'Yesterday'
    } else {
      label = new Date(log.created_at).toLocaleDateString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric'
      })
    }
    if (!groups[label]) groups[label] = []
    groups[label].push(log)
  }

  return Object.entries(groups).map(([label, logs]) => ({ label, logs }))
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

export default async function AuditLogPage() {
  const supabase = await createClient()

  const { data: { session } } = await supabase.auth.getSession()
  const orgId = session?.access_token
    ? JSON.parse(atob(session.access_token.split('.')[1]))?.org_id
    : null

  const { data: logs } = orgId
    ? await supabase
        .from('audit_logs')
        .select('*')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })
        .limit(200)
    : { data: [] }

  const allLogs = (logs as AuditLog[] ?? [])
  const groups = groupByDate(allLogs)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Activity Log</h1>
          <p className="text-sm text-zinc-500 mt-1">
            All user actions performed in your organisation — classifications, changes, and system events.
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-zinc-600 uppercase tracking-wide mb-1">Total Events</p>
          <p className="text-xl font-bold text-white">{allLogs.length}</p>
        </div>
      </div>

      {allLogs.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 py-16 text-center">
          <Activity className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
          <p className="text-sm text-zinc-500">No activity yet.</p>
          <p className="text-xs text-zinc-600 mt-1">
            Actions like changing app classifications will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(({ label, logs: groupLogs }) => (
            <div key={label}>
              <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest mb-3">{label}</p>
              <div className="rounded-xl border border-zinc-800 overflow-hidden">
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-zinc-800/60">
                    {groupLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-zinc-900/40 transition-colors">
                        <td className="px-4 py-3 w-20 shrink-0">
                          <span className="text-[11px] tabular-nums text-zinc-500">
                            {timeLabel(log.created_at)}
                          </span>
                        </td>
                        <td className="px-4 py-3 w-48">
                          <span className="text-xs text-zinc-300 font-medium truncate block max-w-[180px]">
                            {log.user_email ?? 'Unknown user'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-zinc-500">
                            {ACTION_LABELS[log.action] ?? log.action}
                          </span>
                          {log.entity_name && (
                            <span className="text-xs text-white font-medium ml-1">{log.entity_name}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {(log.old_value || log.new_value) && (
                            <div className="flex items-center gap-2">
                              <ClassBadge value={log.old_value} />
                              <span className="text-zinc-700 text-xs">→</span>
                              <ClassBadge value={log.new_value} />
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {!orgId && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 py-12 text-center">
          <p className="text-sm text-zinc-500">Sign in to view your organisation's activity log.</p>
        </div>
      )}
    </div>
  )
}
