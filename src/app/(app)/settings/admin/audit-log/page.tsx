import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { CLASSIFICATION_LABELS } from '@/lib/genai/scoring'
import { cn } from '@/lib/utils'
import { AuditFilters } from './_components/audit-filters'

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
  'classification_changed':       'App classification changed',
  'auth.login_success':           'Logged in',
  'auth.logout':                  'Logged out',
  'auth.signup':                  'Account created',
  'genai.classification_changed': 'App classification changed',
  'onboarding.completed':         'Onboarding completed',
  'regex.pattern_saved':          'Regex pattern saved',
  'regex.pattern_deleted':        'Regex pattern deleted',
  'test_data.dataset_saved':      'Test dataset saved',
  'test_data.dataset_deleted':    'Test dataset deleted',
  'dlp_test.run':                 'DLP test run',
}

const SEVERITY_MAP: Record<string, 'high' | 'medium' | 'low' | 'info'> = {
  'auth.login_success':           'info',
  'auth.logout':                  'info',
  'auth.signup':                  'low',
  'onboarding.completed':         'low',
  'genai.classification_changed': 'medium',
  'classification_changed':       'medium',
  'regex.pattern_saved':          'low',
  'regex.pattern_deleted':        'medium',
  'test_data.dataset_saved':      'low',
  'test_data.dataset_deleted':    'medium',
  'dlp_test.run':                 'low',
}

const SEVERITY_STYLES: Record<string, string> = {
  high:   'bg-red-500/15 text-red-400',
  medium: 'bg-amber-500/15 text-amber-400',
  low:    'bg-blue-500/15 text-blue-400',
  info:   'bg-zinc-700/50 text-zinc-400',
}

const CATEGORY_PREFIXES: Record<string, string> = {
  auth:       'Auth',
  genai:      'GenAI',
  onboarding: 'Onboarding',
  policy:     'Policies',
  user:       'Users',
  tool:       'Tools',
}

function getSeverity(action: string): 'high' | 'medium' | 'low' | 'info' {
  return SEVERITY_MAP[action] ?? 'info'
}

function getCategory(action: string): string {
  const prefix = action.split('.')[0]
  return CATEGORY_PREFIXES[prefix] ?? 'Other'
}

function SeverityBadge({ action }: { action: string }) {
  const sev = getSeverity(action)
  return (
    <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded uppercase', SEVERITY_STYLES[sev])}>
      {sev}
    </span>
  )
}

function CategoryPill({ action }: { action: string }) {
  const cat = getCategory(action)
  const colors: Record<string, string> = {
    Auth:       'bg-blue-500/10 text-blue-400',
    GenAI:      'bg-purple-500/10 text-purple-400',
    Onboarding: 'bg-green-500/10 text-green-400',
    Policies:   'bg-amber-500/10 text-amber-400',
    Users:      'bg-cyan-500/10 text-cyan-400',
    Tools:      'bg-orange-500/10 text-orange-400',
  }
  return (
    <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded', colors[cat] ?? 'bg-zinc-800 text-zinc-500')}>
      {cat}
    </span>
  )
}

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
    return <span className="text-xs text-zinc-400">{log.old_value} → {log.new_value}</span>
  }
  return <span className="text-zinc-600 text-xs">—</span>
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; severity?: string; category?: string; user?: string }>
}) {
  const { range = '7', severity = 'all', category = 'all', user: userSearch = '' } = await searchParams

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

  // Category filter at DB level (prefix match)
  const categoryPrefixMap: Record<string, string> = {
    auth: 'auth.', genai: 'genai.', onboarding: 'onboarding.',
    policy: 'policy.', user: 'user.', tool: 'tool.',
  }
  if (category !== 'all' && categoryPrefixMap[category]) {
    query = query.like('action', `${categoryPrefixMap[category]}%`)
  }

  const { data: rawLogs } = await query
  let allLogs = (rawLogs as AuditLog[]) ?? []

  // Severity + user filters applied in JS (severity computed from action string)
  if (severity !== 'all') {
    allLogs = allLogs.filter(l => getSeverity(l.action) === severity)
  }
  if (userSearch) {
    const q = userSearch.toLowerCase()
    allLogs = allLogs.filter(l => l.user_email?.toLowerCase().includes(q))
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-xs text-zinc-600">
        <span>Admin</span>
        <span>›</span>
        <span className="text-zinc-400">Audit Log</span>
      </div>

      <h2 className="text-2xl font-bold text-white">Audit Log</h2>

      {/* Interactive filter bar */}
      <Suspense>
        <AuditFilters
          currentRange={range}
          currentSeverity={severity}
          currentCategory={category}
          currentUser={userSearch}
        />
      </Suspense>

      {/* Table */}
      <div className="rounded-xl border border-zinc-800 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-zinc-900/80 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white tabular-nums">{allLogs.length}</span>
            <span className="text-xs text-zinc-500">events found</span>
          </div>
          <span className="text-xs text-zinc-600">Sorted by Time ↓</span>
        </div>

        {allLogs.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-zinc-500">No events match your filters.</p>
            <p className="text-xs text-zinc-600 mt-1">Try clearing filters or expanding the time range.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left text-[10px] font-semibold text-zinc-600 uppercase tracking-wide px-4 py-2.5">Time</th>
                <th className="text-left text-[10px] font-semibold text-zinc-600 uppercase tracking-wide px-4 py-2.5">User</th>
                <th className="text-left text-[10px] font-semibold text-zinc-600 uppercase tracking-wide px-4 py-2.5">Severity</th>
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
                    <SeverityBadge action={log.action} />
                  </td>
                  <td className="px-4 py-3">
                    <CategoryPill action={log.action} />
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
