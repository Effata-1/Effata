'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Filter, X, Download, ChevronRight, Search, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  currentRange: string
  currentSeverity: string
  currentCategory: string
  currentUser: string
}

const RANGES = [
  { label: 'Last 24 Hours', value: '1'  },
  { label: 'Last 7 Days',   value: '7'  },
  { label: 'Last 30 Days',  value: '30' },
  { label: 'Last 60 Days',  value: '60' },
  { label: 'Last 90 Days',  value: '90' },
]

const SEVERITIES = ['High', 'Medium', 'Low', 'Info']
const CATEGORIES  = ['Auth', 'GenAI', 'Onboarding']

export function AuditFilters({ currentRange, currentSeverity, currentCategory, currentUser }: Props) {
  const router = useRouter()
  const [openDropdown, setOpenDropdown] = useState<'filter' | 'range' | null>(null)
  const [activeMenu,   setActiveMenu]   = useState<'severity' | 'category' | null>(null)
  const filterRef   = useRef<HTMLDivElement>(null)
  const rangeRef    = useRef<HTMLDivElement>(null)
  const searchRef   = useRef<HTMLInputElement>(null)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const currentRangeLabel = RANGES.find(r => r.value === currentRange)?.label ?? 'Last 7 Days'
  const hasFilters = currentSeverity !== 'all' || currentCategory !== 'all' || currentUser !== ''

  const navigate = useCallback((overrides: Record<string, string>) => {
    const next = { range: currentRange, severity: currentSeverity, category: currentCategory, user: currentUser, ...overrides }
    const params = new URLSearchParams()
    if (next.range && next.range !== '7')    params.set('range',    next.range)
    if (next.severity && next.severity !== 'all') params.set('severity', next.severity)
    if (next.category && next.category !== 'all') params.set('category', next.category)
    if (next.user) params.set('user', next.user)
    const qs = params.toString()
    router.push(`/settings/admin/audit-log${qs ? `?${qs}` : ''}`)
  }, [currentRange, currentSeverity, currentCategory, currentUser, router])

  function selectFilter(key: string, value: string) {
    navigate({ [key]: value.toLowerCase() })
    setOpenDropdown(null)
  }

  function clearFilters() {
    navigate({ severity: 'all', category: 'all', user: '' })
    if (searchRef.current) searchRef.current.value = ''
  }

  function handleUserSearch(value: string) {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => navigate({ user: value }), 400)
  }

  useEffect(() => {
    if (!openDropdown) return
    function handleClick(e: MouseEvent) {
      const target = e.target as Node
      const inFilter = filterRef.current?.contains(target)
      const inRange  = rangeRef.current?.contains(target)
      if (!inFilter && !inRange) setOpenDropdown(null)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [openDropdown])

  return (
    <div className="space-y-3">
      {/* Top row: FILTERS label + Time range + Export */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setOpenDropdown(null)}
          className="flex items-center gap-1.5 text-xs font-bold text-blue-400 uppercase tracking-wider"
        >
          <Filter className="w-3.5 h-3.5" />
          Filters
          <ChevronDown className="w-3 h-3" />
        </button>

        <div className="flex items-center gap-2">
          <button
            className="p-1.5 text-zinc-500 hover:text-zinc-300 border border-zinc-800 rounded-md transition-colors"
            title="Export"
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          {/* Time range dropdown */}
          <div className="relative" ref={rangeRef}>
            <button
              onClick={() => setOpenDropdown(openDropdown === 'range' ? null : 'range')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-zinc-900 border border-zinc-700 rounded-md text-zinc-300 hover:border-zinc-500 transition-colors"
            >
              {currentRangeLabel}
              <ChevronDown className={cn('w-3 h-3 transition-transform', openDropdown === 'range' && 'rotate-180')} />
            </button>

            {openDropdown === 'range' && (
              <div className="absolute top-full mt-1 right-0 z-50 w-44 bg-zinc-800 border border-zinc-700 rounded-lg overflow-hidden shadow-xl">
                {RANGES.map(r => (
                  <button
                    key={r.value}
                    onClick={() => { navigate({ range: r.value }); setOpenDropdown(null) }}
                    className={cn(
                      'w-full px-4 py-2.5 text-sm text-left transition-colors',
                      currentRange === r.value ? 'bg-zinc-700 text-white' : 'text-zinc-300 hover:bg-zinc-700'
                    )}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* User search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
          <input
            ref={searchRef}
            type="text"
            placeholder="Search user..."
            defaultValue={currentUser}
            onChange={e => handleUserSearch(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-xs bg-zinc-900 border border-zinc-700 rounded-md text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 w-52"
          />
        </div>

        {/* ADD FILTER button */}
        <div className="relative" ref={filterRef}>
          <button
            onClick={() => { setOpenDropdown(openDropdown === 'filter' ? null : 'filter'); setActiveMenu(null) }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-md transition-colors uppercase tracking-wide"
          >
            + Add Filter
          </button>

          {openDropdown === 'filter' && (
            <div className="absolute top-full mt-1 left-0 z-50 flex shadow-xl">
              {/* Main menu */}
              <div className="w-48 bg-zinc-800 border border-zinc-700 rounded-lg overflow-hidden">
                {([
                  { key: 'severity' as const, label: 'Severity' },
                  { key: 'category' as const, label: 'Log Type' },
                ] as const).map(menu => (
                  <button
                    key={menu.key}
                    onMouseEnter={() => setActiveMenu(menu.key)}
                    onClick={() => setActiveMenu(menu.key)}
                    className={cn(
                      'w-full flex items-center justify-between px-4 py-3 text-sm text-left transition-colors',
                      activeMenu === menu.key ? 'bg-blue-600 text-white' : 'text-zinc-300 hover:bg-zinc-700'
                    )}
                  >
                    {menu.label}
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                ))}
              </div>

              {activeMenu === 'severity' && (
                <div className="w-36 bg-zinc-800 border border-zinc-700 rounded-lg overflow-hidden ml-px">
                  {SEVERITIES.map(s => (
                    <button
                      key={s}
                      onClick={() => selectFilter('severity', s)}
                      className="w-full px-4 py-2.5 text-sm text-left text-zinc-300 hover:bg-zinc-700 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}

              {activeMenu === 'category' && (
                <div className="w-36 bg-zinc-800 border border-zinc-700 rounded-lg overflow-hidden ml-px">
                  {CATEGORIES.map(c => (
                    <button
                      key={c}
                      onClick={() => selectFilter('category', c)}
                      className="w-full px-4 py-2.5 text-sm text-left text-zinc-300 hover:bg-zinc-700 transition-colors"
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Clear filters */}
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="p-1.5 text-zinc-500 hover:text-zinc-300 border border-zinc-700 rounded-md transition-colors"
            title="Clear all filters"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Active filter chips */}
        {currentSeverity !== 'all' && (
          <span className="flex items-center gap-1 px-2 py-1 text-xs bg-zinc-800 border border-zinc-700 rounded-md text-zinc-300">
            Severity: <span className="capitalize ml-0.5">{currentSeverity}</span>
            <button onClick={() => navigate({ severity: 'all' })} className="text-zinc-500 hover:text-zinc-300 ml-1">
              <X className="w-3 h-3" />
            </button>
          </span>
        )}

        {currentCategory !== 'all' && (
          <span className="flex items-center gap-1 px-2 py-1 text-xs bg-zinc-800 border border-zinc-700 rounded-md text-zinc-300">
            <span className="capitalize">{currentCategory}</span>
            <button onClick={() => navigate({ category: 'all' })} className="text-zinc-500 hover:text-zinc-300 ml-1">
              <X className="w-3 h-3" />
            </button>
          </span>
        )}

        {currentUser && (
          <span className="flex items-center gap-1 px-2 py-1 text-xs bg-zinc-800 border border-zinc-700 rounded-md text-zinc-300">
            User: {currentUser}
            <button
              onClick={() => { navigate({ user: '' }); if (searchRef.current) searchRef.current.value = '' }}
              className="text-zinc-500 hover:text-zinc-300 ml-1"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        )}
      </div>
    </div>
  )
}
