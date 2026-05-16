import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { CLASSIFICATION_LABELS } from '@/lib/genai/scoring'
import { cn } from '@/lib/utils'
import { RefreshCw } from 'lucide-react'

interface AuditLog {
  id: string
  user_email: string | null
  action: string
  entity_type: string | null
  entity_name: string | null
  old_value: string | null
  new_value: string | null
  details: Record<string, unknown> | null
  created_at: string
}

const ACTION_LABELS: Record<string, string> = {
  // Legacy string (old rows)
  'classification_changed':       'App classification changed',
  // Auth
  'auth.login_success':           'Logged in',
  'auth.logout':                  'Logged out',
  'auth.signup':                  'Account created',
  // GenAI
  'genai.classification_changed': 'App classification changed',
  // Onboarding
  'onboarding.completed':         'Onboarding completed',
}

const CATEGORY_PREFIXES: Record<string, string> = {
  'auth':        'Auth',
  'genai':       'GenAI',
  'onboarding':  'Onboarding',
  'policy':      'Policies',
  'user':        'Users',
  'tool':        'Tools',
}

function getCategory(action: string): string {
  const prefix = action.split('.')[0]
  return CATEGORY_PREFIXES[prefix] ?? 'Other'
}

const RANGES = [
  { label: 'Last 7 Days',  value: '7' },
  { label: 'Last 30 Days', value: '30' },
  { label: 'All Time',     value: 'all' },
]

const CATEGORIES = [
  { label: 'All',         value: 'all',        prefix: null },
  { label: 'Auth',        value: 'auth',        prefix: 'auth.' },
  { label: 'GenAI',       value: 'genai',       prefix: 'genai.' },
  { label: 'Onboarding',  value: 'onboarding',  prefix: 'onboarding.' },
]

function ClassBadge({ value }: { value: string | null }) {
  if (!value) return <span className="text-zinc-600 text-xs">—</span>
  const meta = CLASSIFICATION_LABELS[value]
  if (!meta) return <span className="text-zinc-400 text-xs">{value}</span>
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

function CategoryPill({ category }: { category: string }) {
  const colors: Record<string, string> = {
    'Auth':       'bg-blue-500/10 text-blue-400',
    'GenAI':      'bg-purple-500/10 text-purple-400',
    'Onboarding': 'bg-green-500/10 text-green-400',
    'Policies':   'bg-amber-500/10 text-amber-400',
    'Users':      'bg-cyan-500/10 text-cyan-400',
    'Tools':      'bg-orange-500/10 text-orange-400',
  }
  return (
    <span className={cn(
      'text-[10px] font-medium px-1.5 py-0.5 rounded',
      colors[category] ?? 'bg-zinc-800 text-zinc-500'
    )}>
      {category}
    </span>
  )
}

function renderChange(log: AuditLog) {
  if (log.old_value || log.new_value) {
    const knownClasses = Object.keys(CLASSIFICATION_LABELS)
    const isClassChange =
      (!log.old_value || knownClasses.includes(log.old_value)) &&
      (!log.new_value || knownClasses.includes(log.new_value))

    if (isClassChange) {
      return (
        <div className="flex items-center gap-1.5">
          <ClassBadge value={log.old_value} />
          <span className="text-zinc-700 text-xs">→</span>
          <ClassBadge value={log.new_value} />
        </div>
      )
    }

    return (
      <span className="text-xs text-zinc-400">
        {log.old_value} → {log.new_value}
      </span>
    )
  }
  return <span className="text-zinc-600 text-xs">—</span>
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; category?: string }>
}) {
  const { range = '7', category = 'all' } = await searchParams

  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const orgId = session?.access_token
    ? JSON.parse(atob(session.access_token.split('.')[1]))?.org_id
    : null

  let query = supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500)

  if (orgId) query = query.eq('org_id', orgId)

  if (range !== 'all') {
    const since = new Date(Date.now() - parseInt(range) * 24 * 60 * 60 * 1000).toISOString()
    query = query.gte('created_at', since)
  }

  const activeCategory = CATEGORIES.find(c => c.value === category)
  if (activeCategory?.prefix) {
    query = query.like('action', `${activeCategory.prefix}%`)
  }

  const { data: logs } = await query
  const allLogs = (logs as AuditLog[] ?? [])

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-xs text-zinc-600">
        <span>Admin</span>
        <span>›</span>
        <span className="text-zinc-400">Audit Log</span>
      </div>

      {/* Title + filters row */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-bold text-white">Audit Log</h2>
          <Link
            href={`/settings/admin/audit-log?range=${range}&category=${category}`}
            className="text-zinc-600 hover:text-zinc-400 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </Link>
        </div>

        <div className="flex items-center gap-2">
          {/* Category filter */}
          <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-1">
            {CATEGORIES.map(c => (
              <Link
                key={c.value}
                href={`?range=${range}&category=${c.value}`}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                  category === c.value
                    ? 'bg-zinc-700 text-white'
                    : 'text-zinc-500 hover:text-zinc-300'
                )}
              >
                {c.label}
              </Link>
            ))}
          </div>

          {/* Time range filter */}
          <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-1">
            {RANGES.map(r => (
              <Link
                key={r.value}
                href={`?range=${r.value}&category=${category}`}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                  range === r.value
                    ? 'bg-zinc-700 text-white'
                    : 'text-zinc-500 hover:text-zinc-300'
                )}
              >
                {r.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-zinc-800 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-zinc-900/80 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white tabular-nums">{allLogs.length}</span>
            <span className="text-xs text-zinc-500">events found</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-600">
            <span>Sorted by Time ↓</span>
          </div>
        </div>

        {allLogs.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-zinc-500">No events in this time range.</p>
            <p className="text-xs text-zinc-600 mt-1">
              Try switching to a wider range or a different category.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left text-[10px] font-semibold text-zinc-600 uppercase tracking-wide px-4 py-2.5">Time</th>
                <th className="text-left text-[10px] font-semibold text-zinc-600 uppercase tracking-wide px-4 py-2.5">User</th>
                <th className="text-left text-[10px] font-semibold text-zinc-600 uppercase tracking-wide px-4 py-2.5">Category</th>
                <th className="text-left text-[10px] font-semibold text-zinc-600 uppercase tracking-wide px-4 py-2.5">Action</th>
                <th className="text-left text-[10px] font-semibold text-zinc-600 uppercase tracking-wide px-4 py-2.5">Target</th>
                <th className="text-left text-[10px] font-semibold text-zinc-600 uppercase tracking-wide px-4 py-2.5">Change</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {allLogs.map(log => (
                <tr key={log.id} className="hover:bg-zinc-900/40 transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-xs tabular-nums text-zinc-500">{formatTime(log.created_at)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-zinc-300">{log.user_email ?? 'System'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <CategoryPill category={getCategory(log.action)} />
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-zinc-400">{ACTION_LABELS[log.action] ?? log.action}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-white font-medium">{log.entity_name ?? log.entity_type ?? '—'}</span>
                  </td>
                  <td className="px-4 py-3">
                    {renderChange(log)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
