'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Search, X, Filter } from 'lucide-react'
import type { AuditEntry, RegulationRef } from '../page'

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
  const [regFilter, setReg]   = useState('all')
  const [ctrlFilter, setCtrl] = useState('all')

  const regMap = new Map(regulations.map(r => [r.id, r]))

  const q = search.toLowerCase().trim()
  const visible = entries.filter(e => {
    const regId = e.details?.regulation_id ?? ''
    const reg   = regMap.get(regId)

    if (regFilter !== 'all' && reg?.code !== regFilter) return false
    if (ctrlFilter !== 'all' && e.entity_name !== ctrlFilter) return false
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
            className="bg-zinc-900 border border-zinc-800 rounded-lg pl-8 pr-8 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-blue-600 w-72"
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

        <div className="flex items-center gap-1.5 text-zinc-600">
          <Filter className="h-3.5 w-3.5" />
        </div>

        <select
          value={regFilter}
          onChange={e => setReg(e.target.value)}
          className="text-xs bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-400 focus:outline-none focus:border-blue-600"
        >
          <option value="all">All Regulations</option>
          {regulations.map(r => (
            <option key={r.id} value={r.code}>{r.short_name}</option>
          ))}
        </select>

        <select
          value={ctrlFilter}
          onChange={e => setCtrl(e.target.value)}
          className="text-xs bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-400 focus:outline-none focus:border-blue-600"
        >
          <option value="all">All Controls</option>
          {controls.map(c => (
            <option key={c.key} value={c.key}>{c.label}</option>
          ))}
        </select>

        <span className="text-xs text-zinc-600 ml-auto">
          {visible.length} {visible.length === 1 ? 'entry' : 'entries'}
          {entries.length >= 200 && ' (last 200)'}
        </span>
      </div>

      {/* Table */}
      {visible.length === 0 ? (
        <div className="py-16 text-center rounded-xl border border-zinc-800">
          <p className="text-sm text-zinc-500">No audit entries found.</p>
          {(search || regFilter !== 'all' || ctrlFilter !== 'all') && (
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
              {visible.map(e => {
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

      <p className="text-xs text-zinc-600">
        All changes are logged automatically. This trail is read-only and cannot be modified.
      </p>
    </div>
  )
}
