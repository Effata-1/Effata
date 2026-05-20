'use client'

import { cn } from '@/lib/utils'
import { CLASSIFICATION_LABELS } from '@/lib/genai/scoring'
import { usePagination } from '@/hooks/use-pagination'

export interface AuditLog {
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
  'dlp_test.run':                         'DLP test run',
  'compliance.regulation_verified':       'Regulation marked as verified',
  'compliance.assessment_updated':        'Control assessment updated',
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
  'dlp_test.run':                         'low',
  'compliance.regulation_verified':       'low',
  'compliance.assessment_updated':        'low',
}

const SEVERITY_STYLES: Record<string, string> = {
  high:   'bg-red-500/15 text-red-400',
  medium: 'bg-amber-500/15 text-amber-400',
  low:    'bg-blue-500/15 text-blue-400',
  info:   'bg-accent/50 text-muted-foreground',
}

const CATEGORY_PREFIXES: Record<string, string> = {
  auth:        'Auth',
  genai:       'GenAI',
  onboarding:  'Onboarding',
  policy:      'Policies',
  user:        'Users',
  tool:        'Tools',
  compliance:  'Compliance',
  dlp_test:    'Tools',
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
    Auth:        'bg-blue-500/10 text-blue-400',
    GenAI:       'bg-purple-500/10 text-purple-400',
    Onboarding:  'bg-green-500/10 text-green-400',
    Policies:    'bg-amber-500/10 text-amber-400',
    Users:       'bg-cyan-500/10 text-cyan-400',
    Tools:       'bg-orange-500/10 text-orange-400',
    Compliance:  'bg-teal-500/10 text-teal-400',
  }
  return (
    <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded', colors[cat] ?? 'bg-muted text-muted-foreground/80')}>
      {cat}
    </span>
  )
}

function ClassBadge({ value }: { value: string | null }) {
  if (!value) return <span className="text-muted-foreground/60 text-xs">—</span>
  const meta = CLASSIFICATION_LABELS[value]
  if (!meta) return <span className="text-muted-foreground text-xs">{value}</span>
  return (
    <span className={cn(
      'text-[10px] font-bold px-1.5 py-0.5 rounded',
      meta.color === 'green'  ? 'bg-green-500/15 text-green-400'   :
      meta.color === 'red'    ? 'bg-red-500/15 text-red-400'       :
      meta.color === 'amber'  ? 'bg-yellow-500/15 text-yellow-400' :
      meta.color === 'blue'   ? 'bg-blue-500/15 text-blue-400'     :
      meta.color === 'purple' ? 'bg-purple-500/15 text-purple-400' :
      'bg-accent/50 text-muted-foreground'
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
          <span className="text-muted-foreground/40 text-xs">→</span>
          <ClassBadge value={log.new_value} />
        </div>
      )
    }
    return <span className="text-xs text-muted-foreground">{log.old_value} → {log.new_value}</span>
  }
  return <span className="text-muted-foreground/60 text-xs">—</span>
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

const PER_PAGE_OPTIONS = [10, 25, 50, 100]

export function AuditLogTable({ logs }: { logs: AuditLog[] }) {
  const pg = usePagination(logs, 10, 'admin_audit_log')

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-card/80 border-b border-border">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground tabular-nums">{pg.total}</span>
            <span className="text-xs text-muted-foreground/80">events found</span>
          </div>
          <span className="text-xs text-muted-foreground/60">Sorted by Time ↓</span>
        </div>

        {logs.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-muted-foreground/80">No events match your filters.</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Try clearing filters or expanding the time range.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wide px-4 py-2.5">Time</th>
                <th className="text-left text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wide px-4 py-2.5">User</th>
                <th className="text-left text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wide px-4 py-2.5">Severity</th>
                <th className="text-left text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wide px-4 py-2.5">Category</th>
                <th className="text-left text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wide px-4 py-2.5">Action</th>
                <th className="text-left text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wide px-4 py-2.5">Target</th>
                <th className="text-left text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wide px-4 py-2.5">Change</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {pg.slice.map(log => (
                <tr key={log.id} className="hover:bg-card/40 transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-xs tabular-nums text-muted-foreground/80">{formatTime(log.created_at)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-foreground/70">{log.user_email ?? 'System'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <SeverityBadge action={log.action} />
                  </td>
                  <td className="px-4 py-3">
                    <CategoryPill action={log.action} />
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-muted-foreground">{ACTION_LABELS[log.action] ?? log.action}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-foreground font-medium">{log.entity_name ?? log.entity_type ?? '—'}</span>
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

      {/* Pagination footer */}
      {pg.total > pg.perPage && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground/60 tabular-nums">
            Showing {pg.from}–{pg.to} of {pg.total}
          </span>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <button
                onClick={() => pg.setPage(pg.page - 1)}
                disabled={pg.page === 1}
                className="px-2.5 py-1 text-xs rounded bg-muted text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >←</button>
              <span className="text-xs text-muted-foreground/60 px-2 tabular-nums">{pg.page} / {pg.pages}</span>
              <button
                onClick={() => pg.setPage(pg.page + 1)}
                disabled={pg.page === pg.pages}
                className="px-2.5 py-1 text-xs rounded bg-muted text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >→</button>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground/60">Rows per page:</span>
              <select
                value={pg.perPage}
                onChange={e => pg.setPerPage(Number(e.target.value))}
                className="bg-muted border border-border-strong text-foreground/70 text-xs rounded px-2 py-0.5 focus:outline-none focus:border-border-strong"
              >
                {PER_PAGE_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
