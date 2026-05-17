import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'

interface AuditEvent {
  id: string
  source: 'activity' | 'verification'
  user_email: string | null
  action: string
  entity_name: string | null
  details: Record<string, unknown> | null
  created_at: string
}

const ACTION_LABELS: Record<string, string> = {
  'auth.login_success':               'Logged in',
  'auth.logout':                      'Logged out',
  'auth.signup':                      'Account created',
  'compliance.regulation_verified':   'Regulation marked as verified',
  'compliance.assessment_updated':    'Control assessment updated',
  'genai.classification_changed':     'App classification changed',
  'dlp_test.run':                     'DLP test run',
  'regex.pattern_saved':              'Regex pattern saved',
  'test_data.dataset_saved':          'Test dataset saved',
  'onboarding.completed':             'Onboarding completed',
}

const SEVERITY_MAP: Record<string, 'high' | 'medium' | 'low' | 'info'> = {
  'compliance.regulation_verified':   'low',
  'compliance.assessment_updated':    'low',
  'auth.login_success':               'info',
  'auth.logout':                      'info',
  'dlp_test.run':                     'low',
  'genai.classification_changed':     'medium',
}

const SEVERITY_STYLES: Record<string, string> = {
  high:   'bg-red-500/15 text-red-400',
  medium: 'bg-amber-500/15 text-amber-400',
  low:    'bg-blue-500/15 text-blue-400',
  info:   'bg-zinc-700/50 text-zinc-400',
}

function getSeverity(action: string): 'high' | 'medium' | 'low' | 'info' {
  return SEVERITY_MAP[action] ?? 'info'
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default async function AuditTrailPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>
}) {
  const { range = '30' } = await searchParams

  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const orgId = session?.access_token
    ? JSON.parse(atob(session.access_token.split('.')[1]))?.org_id
    : null

  const since = range !== 'all'
    ? new Date(Date.now() - parseInt(range) * 24 * 60 * 60 * 1000).toISOString()
    : null

  let auditQuery = supabase
    .from('audit_logs')
    .select('id, user_email, action, entity_name, details, created_at')
    .order('created_at', { ascending: false })
    .limit(300)
  if (orgId)  auditQuery = auditQuery.eq('org_id', orgId)
  if (since)  auditQuery = auditQuery.gte('created_at', since)

  let verifyQuery = supabase
    .from('compliance_verification_log')
    .select('id, org_id, verified_at, changed, notes, regulation_id, verified_by')
    .order('verified_at', { ascending: false })
    .limit(200)
  if (orgId) verifyQuery = verifyQuery.eq('org_id', orgId)
  if (since) verifyQuery = verifyQuery.gte('verified_at', since)

  const [{ data: auditData }, { data: verifyData }] = await Promise.all([auditQuery, verifyQuery])

  const auditEvents: AuditEvent[] = (auditData ?? []).map((r: Record<string, unknown>) => ({
    id:          r.id as string,
    source:      'activity',
    user_email:  r.user_email as string | null,
    action:      r.action as string,
    entity_name: r.entity_name as string | null,
    details:     r.details as Record<string, unknown> | null,
    created_at:  r.created_at as string,
  }))

  const verifyEvents: AuditEvent[] = (verifyData ?? []).map((r: Record<string, unknown>) => ({
    id:          r.id as string,
    source:      'verification',
    user_email:  null,
    action:      'compliance.regulation_verified',
    entity_name: (r.notes as string | null) ?? 'Regulation verification',
    details:     { changed: r.changed, notes: r.notes },
    created_at:  r.verified_at as string,
  }))

  const events = [...auditEvents, ...verifyEvents]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 500)

  const RANGE_OPTIONS = [
    { value: '7',   label: 'Last 7 days' },
    { value: '30',  label: 'Last 30 days' },
    { value: '90',  label: 'Last 90 days' },
    { value: 'all', label: 'All time' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Audit Trail</h1>
        <p className="text-zinc-500 text-sm">
          Complete activity log including compliance assessments, regulation verifications, and all user actions — your evidence record for auditors
        </p>
      </div>

      {/* Range filter */}
      <div className="flex items-center gap-2">
        {RANGE_OPTIONS.map(opt => (
          <a
            key={opt.value}
            href={`?range=${opt.value}`}
            className={cn(
              'text-xs px-3 py-1.5 rounded-md transition-colors',
              range === opt.value
                ? 'bg-white/10 text-white font-medium'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
            )}
          >
            {opt.label}
          </a>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-zinc-800 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-zinc-900/80 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white tabular-nums">{events.length}</span>
            <span className="text-xs text-zinc-500">events found</span>
          </div>
          <span className="text-xs text-zinc-600">Sorted by Time ↓</span>
        </div>

        {events.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-zinc-500">No events in this time range.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left text-[10px] font-semibold text-zinc-600 uppercase tracking-wide px-4 py-2.5">Time</th>
                <th className="text-left text-[10px] font-semibold text-zinc-600 uppercase tracking-wide px-4 py-2.5">User</th>
                <th className="text-left text-[10px] font-semibold text-zinc-600 uppercase tracking-wide px-4 py-2.5">Severity</th>
                <th className="text-left text-[10px] font-semibold text-zinc-600 uppercase tracking-wide px-4 py-2.5">Action</th>
                <th className="text-left text-[10px] font-semibold text-zinc-600 uppercase tracking-wide px-4 py-2.5">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {events.map(ev => {
                const sev = getSeverity(ev.action)
                return (
                  <tr key={`${ev.source}-${ev.id}`} className="hover:bg-zinc-900/40 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs tabular-nums text-zinc-500">{formatTime(ev.created_at)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-zinc-300">{ev.user_email ?? 'System'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded uppercase', SEVERITY_STYLES[sev])}>
                        {sev}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-zinc-400">{ACTION_LABELS[ev.action] ?? ev.action}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-white">{ev.entity_name ?? '—'}</span>
                      {ev.source === 'verification' && Boolean(ev.details?.changed) && (
                        <span className="ml-2 text-[10px] text-amber-400">(content changed)</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
