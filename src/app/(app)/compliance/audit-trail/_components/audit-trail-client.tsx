'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Search, X } from 'lucide-react'
import type { AuditEntry, RegulationRef } from '../page'
import { MultiFilterSelect } from '@/components/ui/filter-select'
import { usePagination } from '@/hooks/use-pagination'

const STATUS_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  implemented:     { label: 'Implemented',     color: 'text-green-400',  bg: 'bg-green-500/15' },
  partial:         { label: 'Partial',         color: 'text-amber-400',  bg: 'bg-amber-500/15' },
  not_implemented: { label: 'Not Implemented', color: 'text-red-400',    bg: 'bg-red-500/15'   },
  not_assessed:    { label: 'Not Assessed',    color: 'text-zinc-400',   bg: 'bg-zinc-700/50'  },
}

function StatusBadge({ value }: { value: string | null }) {
  const s = value ? (STATUS_STYLE[value] ?? STATUS_STYLE.not_assessed) : STATUS_STYLE.not_assessed
  return (
    <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded whitespace-nowrap', s.color, s.bg)}>
      {s.label}
    </span>
  )
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    + ' · '
    + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

export function AuditTrailClient({
  entries,
  regulations,
  controls,
}: {
  entries: AuditEntry[]
  regulations: RegulationRef[]
  controls: { key: string; label: string }[]
}) {
  const [search, setSearch]   = useState('')
  const [regFilter, setReg]   = useState<string[]>([])
  const [ctrlFilter, setCtrl] = useState<string[]>([])

  const regMap = new Map(regulations.map(r => [r.id, r]))

  const q = search.toLowerCase().trim()
  const visible = entries.filter(e => {
    const regId = e.details?.regulation_id ?? ''
    const reg   = regMap.get(regId)

    if (regFilter.length > 0 && !regFilter.includes(reg?.code ?? '')) return false
    if (ctrlFilter.length > 0 && !ctrlFilter.includes(e.entity_name)) return false
    if (q) {
      const ctrl = controls.find(c => c.key === e.entity_name)
      const searchable = [
        e.user_email ?? '',
        ctrl?.label ?? e.entity_name,
        reg?.short_name ?? '',
        e.old_value ?? '',
        e.new_value ?? '',
      ].join(' ').toLowerCase()
      if (!searchable.includes(q)) return false
    }
    return true
  })

  const pg = usePagination(visible, 10, 'audit_trail')
  const PER_PAGE_OPTIONS = [10, 25, 50, 100]

  useEffect(() => { pg.setPage(1) }, [search, regFilter, ctrlFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-600 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search user, control, regulation…"
            className="bg-zinc-900 border border-zinc-800 rounded-xl pl-8 pr-8 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 w-72"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <MultiFilterSelect
          options={regulations.map(r => ({ value: r.code, label: r.short_name }))}
          value={regFilter}
          onChange={setReg}
          placeholder="All Regulations"
        />

        <MultiFilterSelect
          options={controls.map(c => ({ value: c.key, label: c.label }))}
          value={ctrlFilter}
          onChange={setCtrl}
          placeholder="All Controls"
        />

        <span className="text-xs text-zinc-600 ml-auto">
          {pg.total} {pg.total === 1 ? 'entry' : 'entries'}
          {entries.length >= 200 && ' (last 200)'}
        </span>
      </div>

      {/* Table */}
      {visible.length === 0 ? (
        <div className="py-16 text-center rounded-xl border border-zinc-800">
          <p className="text-sm text-zinc-500">No audit entries found.</p>
          {(search || regFilter.length > 0 || ctrlFilter.length > 0) && (
            <p className="text-xs text-zinc-600 mt-1">Try clearing your filters.</p>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/80">
                <th className="text-left text-[10px] font-semibold text-zinc-600 uppercase tracking-wide px-5 py-2.5">Date</th>
                <th className="text-left text-[10px] font-semibold text-zinc-600 uppercase tracking-wide px-4 py-2.5 hidden md:table-cell">User</th>
                <th className="text-left text-[10px] font-semibold text-zinc-600 uppercase tracking-wide px-4 py-2.5">Regulation</th>
                <th className="text-left text-[10px] font-semibold text-zinc-600 uppercase tracking-wide px-4 py-2.5">Control</th>
                <th className="text-left text-[10px] font-semibold text-zinc-600 uppercase tracking-wide px-4 py-2.5">Change</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {pg.slice.map(e => {
                const reg  = regMap.get(e.details?.regulation_id ?? '')
                const ctrl = controls.find(c => c.key === e.entity_name)
                return (
                  <tr key={e.id} className="hover:bg-zinc-900/40 transition-colors">
                    <td className="px-5 py-3 whitespace-nowrap">
                      <span className="text-xs text-zinc-400 tabular-nums">{formatDate(e.created_at)}</span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-xs text-zinc-400 truncate max-w-[160px] block">{e.user_email ?? '—'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-zinc-300">{reg?.short_name ?? '—'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-zinc-300">{ctrl?.label ?? e.entity_name}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <StatusBadge value={e.old_value} />
                        <span className="text-zinc-700 text-xs">→</span>
                        <StatusBadge value={e.new_value} />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination footer */}
      {pg.total > pg.perPage && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-zinc-600 tabular-nums">
            Showing {pg.from}–{pg.to} of {pg.total}
          </span>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <button
                onClick={() => pg.setPage(pg.page - 1)}
                disabled={pg.page === 1}
                className="px-2.5 py-1 text-xs rounded bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >←</button>
              <span className="text-xs text-zinc-600 px-2 tabular-nums">{pg.page} / {pg.pages}</span>
              <button
                onClick={() => pg.setPage(pg.page + 1)}
                disabled={pg.page === pg.pages}
                className="px-2.5 py-1 text-xs rounded bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >→</button>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-zinc-600">Rows per page:</span>
              <select
                value={pg.perPage}
                onChange={e => pg.setPerPage(Number(e.target.value))}
                className="bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs rounded px-2 py-0.5 focus:outline-none focus:border-zinc-500"
              >
                {PER_PAGE_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>
        </div>
      )}

      <p className="text-xs text-zinc-600">
        All changes are logged automatically. This trail is read-only and cannot be modified.
      </p>
    </div>
  )
}
