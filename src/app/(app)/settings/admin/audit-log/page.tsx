import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { AuditFilters } from './_components/audit-filters'
import { AuditLogTable } from './_components/audit-log-table'
import type { AuditLog } from './_components/audit-log-table'
import { getSeverity, CATEGORY_PREFIXES_FOR_FILTER } from './_lib/audit-actions'

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; severity?: string; category?: string; user?: string }>
}) {
  const { range = '7', severity = 'all', category = 'all', user: userSearch = '' } = await searchParams

  const { orgId } = await requireRole('admin')
  const supabase = await createClient()

  let query = supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500)

  if (orgId) query = query.eq('org_id', orgId)

  if (range !== 'all') {
    // eslint-disable-next-line react-hooks/purity
    const since = new Date(Date.now() - parseInt(range) * 24 * 60 * 60 * 1000).toISOString()
    query = query.gte('created_at', since)
  }

  const prefixes = category !== 'all' ? CATEGORY_PREFIXES_FOR_FILTER[category] : undefined
  if (prefixes?.length) {
    if (prefixes.length === 1) {
      query = query.like('action', `${prefixes[0]}%`)
    } else {
      // Build OR: action.like.prefix1%,action.like.prefix2%,...
      query = query.or(prefixes.map(p => `action.like.${p}%`).join(','))
    }
  }

  const { data: rawLogs } = await query
  let allLogs = (rawLogs as AuditLog[]) ?? []

  if (severity !== 'all') {
    allLogs = allLogs.filter(l => getSeverity(l.action) === severity)
  }
  if (userSearch) {
    const q = userSearch.toLowerCase()
    allLogs = allLogs.filter(l => l.user_email?.toLowerCase().includes(q))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60">
        <span>Admin</span>
        <span>›</span>
        <span className="text-muted-foreground">Audit Log</span>
      </div>

      <h2 className="text-2xl font-bold text-foreground">Audit Log</h2>

      <Suspense>
        <AuditFilters
          currentRange={range}
          currentSeverity={severity}
          currentCategory={category}
          currentUser={userSearch}
        />
      </Suspense>

      <AuditLogTable logs={allLogs} />
    </div>
  )
}
