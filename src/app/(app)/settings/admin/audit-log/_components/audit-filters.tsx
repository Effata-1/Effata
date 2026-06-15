'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Download, ChevronDown, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AUDIT_CATEGORIES } from '../_lib/audit-actions'
import { FilterChip, AddFilterButton } from '@/components/ui/add-filter-button'

interface Props {
  currentRange:    string
  currentSeverity: string
  currentCategory: string
  currentUser:     string
}

const RANGES = [
  { label: 'Last 24 Hours', value: '1'  },
  { label: 'Last 7 Days',   value: '7'  },
  { label: 'Last 30 Days',  value: '30' },
  { label: 'Last 60 Days',  value: '60' },
  { label: 'Last 90 Days',  value: '90' },
]

const SEVERITY_OPTIONS = [
  { value: 'high',   label: 'High'   },
  { value: 'medium', label: 'Medium' },
  { value: 'low',    label: 'Low'    },
  { value: 'info',   label: 'Info'   },
]

export function AuditFilters({ currentRange, currentSeverity, currentCategory, currentUser }: Props) {
  const router    = useRouter()
  const [rangeOpen, setRangeOpen] = useState(false)
  const rangeRef    = useRef<HTMLDivElement>(null)
  const searchRef   = useRef<HTMLInputElement>(null)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const currentRangeLabel = RANGES.find(r => r.value === currentRange)?.label ?? 'Last 7 Days'

  const navigate = useCallback((overrides: Record<string, string>) => {
    const next = { range: currentRange, severity: currentSeverity, category: currentCategory, user: currentUser, ...overrides }
    const params = new URLSearchParams()
    if (next.range    && next.range    !== '7')   params.set('range',    next.range)
    if (next.severity && next.severity !== 'all') params.set('severity', next.severity)
    if (next.category && next.category !== 'all') params.set('category', next.category)
    if (next.user) params.set('user', next.user)
    const qs = params.toString()
    router.push(`/settings/admin/audit-log${qs ? `?${qs}` : ''}`)
  }, [currentRange, currentSeverity, currentCategory, currentUser, router])

  function handleUserSearch(value: string) {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => navigate({ user: value }), 400)
  }

  useEffect(() => {
    if (!rangeOpen) return
    function handleClick(e: MouseEvent) {
      if (!rangeRef.current?.contains(e.target as Node)) setRangeOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [rangeOpen])

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* User search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/80 pointer-events-none" />
        <input
          ref={searchRef}
          type="text"
          placeholder="Search user…"
          defaultValue={currentUser}
          onChange={e => handleUserSearch(e.target.value)}
          className="pl-8 pr-3 py-2 text-xs bg-card border border-border rounded-lg text-foreground/70 placeholder-muted-foreground/50 focus:outline-none focus:border-border-strong w-52"
        />
      </div>

      {/* Shared Add Filter button */}
      <AddFilterButton
        defs={[
          { key: 'severity', label: 'Severity', type: 'single', options: SEVERITY_OPTIONS  },
          { key: 'category', label: 'Log Type', type: 'single', options: AUDIT_CATEGORIES  },
        ]}
        value={{
          severity: currentSeverity === 'all' ? '' : currentSeverity,
          category: currentCategory === 'all' ? '' : currentCategory,
        }}
        onChange={(key, val) => navigate({ [key]: (val as string) || 'all' })}
      />

      {/* User chip rendered externally (not managed by AddFilterButton) */}
      {currentUser && (
        <FilterChip
          label={`User: ${currentUser}`}
          onRemove={() => { navigate({ user: '' }); if (searchRef.current) searchRef.current.value = '' }}
        />
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Export */}
      <button
        className="p-1.5 text-muted-foreground/80 hover:text-foreground/70 border border-border rounded-md transition-colors"
        title="Export"
      >
        <Download className="w-3.5 h-3.5" />
      </button>

      {/* Time range dropdown */}
      <div className="relative" ref={rangeRef}>
        <button
          onClick={() => setRangeOpen(v => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-card border border-border rounded-lg text-foreground/70 hover:border-border-strong transition-colors"
        >
          {currentRangeLabel}
          <ChevronDown className={cn('w-3 h-3 transition-transform', rangeOpen && 'rotate-180')} />
        </button>

        {rangeOpen && (
          <div className="absolute top-full mt-1 right-0 z-50 w-44 bg-muted border border-border rounded-lg overflow-hidden shadow-xl">
            {RANGES.map(r => (
              <button
                key={r.value}
                onClick={() => { navigate({ range: r.value }); setRangeOpen(false) }}
                className={cn(
                  'w-full px-4 py-2.5 text-sm text-left transition-colors',
                  currentRange === r.value ? 'bg-accent text-foreground' : 'text-foreground/70 hover:bg-accent',
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
