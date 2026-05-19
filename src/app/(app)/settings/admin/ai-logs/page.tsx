import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'

interface AiSearchLog {
  id:         string
  user_id:    string | null
  source:     string
  prompt:     string
  result:     string | null
  created_at: string
}

const SOURCE_META: Record<string, { label: string; cls: string }> = {
  file_generator:  { label: 'File Gen',   cls: 'bg-blue-500/15 text-blue-400' },
  test_data:       { label: 'Test Data',  cls: 'bg-green-500/15 text-green-400' },
  regex_lab:       { label: 'Regex Lab',  cls: 'bg-purple-500/15 text-purple-400' },
  evidence_report: { label: 'Evidence',   cls: 'bg-amber-500/15 text-amber-400' },
}

function SourceBadge({ source }: { source: string }) {
  const m = SOURCE_META[source] ?? { label: source, cls: 'bg-zinc-700/50 text-zinc-400' }
  return (
    <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded uppercase', m.cls)}>
      {m.label}
    </span>
  )
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default async function AiLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string; page?: string }>
}) {
  const { source = 'all', page: pageStr = '1' } = await searchParams
  const page    = Math.max(1, parseInt(pageStr) || 1)
  const perPage = 25
  const from    = (page - 1) * perPage
  const to      = from + perPage - 1

  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const orgId = session?.access_token
    ? JSON.parse(atob(session.access_token.split('.')[1]))?.org_id
    : null

  let query = supabase
    .from('ai_search_logs')
    .select('id, user_id, source, prompt, result, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (orgId) query = query.eq('org_id', orgId)
  if (source !== 'all') query = query.eq('source', source)

  const { data: logs, count } = await query
  const allLogs = (logs as AiSearchLog[]) ?? []
  const total   = count ?? 0
  const pages   = Math.max(1, Math.ceil(total / perPage))

  const sources = ['all', 'file_generator', 'test_data', 'regex_lab', 'evidence_report']

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-1.5 text-xs text-zinc-600">
        <span>Admin</span><span>›</span>
        <span className="text-zinc-400">AI Logs</span>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">AI Search Logs</h2>
        <span className="text-xs text-zinc-500 tabular-nums">{total} total entries</span>
      </div>

      {/* Source filter */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {sources.map(s => (
          <a
            key={s}
            href={`?source=${s}&page=1`}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              source === s
                ? 'bg-blue-600 text-white'
                : 'bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700'
            )}
          >
            {s === 'all' ? 'All sources' : (SOURCE_META[s]?.label ?? s)}
          </a>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-zinc-800 overflow-hidden">
        {allLogs.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-zinc-500">No AI searches recorded yet.</p>
            <p className="text-xs text-zinc-600 mt-1">AI activity will appear here after users make their first searches.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800">
                {['Time', 'Source', 'Prompt', 'Result'].map(h => (
                  <th key={h} className="text-left text-[10px] font-semibold text-zinc-600 uppercase tracking-wide px-4 py-2.5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {allLogs.map(log => (
                <tr key={log.id} className="hover:bg-zinc-900/40 transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-[10px] tabular-nums text-zinc-500">{formatTime(log.created_at)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <SourceBadge source={log.source} />
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    <p className="text-xs text-zinc-300 truncate" title={log.prompt}>{log.prompt}</p>
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    <p className="text-xs text-zinc-500 truncate">{log.result ?? '—'}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between text-xs text-zinc-500">
          <span>Showing {from + 1}–{Math.min(from + perPage, total)} of {total}</span>
          <div className="flex items-center gap-1">
            {page > 1 && (
              <a href={`?source=${source}&page=${page - 1}`}
                className="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors">
                ← Prev
              </a>
            )}
            <span className="px-3 py-1.5 text-zinc-600">Page {page} of {pages}</span>
            {page < pages && (
              <a href={`?source=${source}&page=${page + 1}`}
                className="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors">
                Next →
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
