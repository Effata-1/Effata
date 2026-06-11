'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { SlidersHorizontal, ChevronRight, X, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── FilterChip (still exported for policy-list custom picker) ─────────────────

export function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 text-blue-400 text-xs font-medium whitespace-nowrap">
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="ml-0.5 rounded hover:text-blue-200 transition-colors"
      >
        <X className="w-3 h-3" />
      </button>
    </span>
  )
}

// ── AddFilterButton ───────────────────────────────────────────────────────────

export interface FilterSectionDef {
  key:     string
  label:   string
  type:    'single' | 'multi'
  options: { value: string; label: string }[]
}

interface AddFilterButtonProps {
  defs:      FilterSectionDef[]
  value:     Record<string, string | string[]>
  onChange:  (key: string, val: string | string[]) => void
  className?: string
}

function getChipLabel(def: FilterSectionDef, val: string | string[]): string {
  if (def.type === 'multi') {
    const arr = val as string[]
    if (!arr.length) return ''
    const first = def.options.find(o => o.value === arr[0])?.label ?? arr[0]
    return arr.length === 1
      ? `${def.label}: ${first}`
      : `${def.label}: ${first} + ${arr.length - 1} more`
  }
  const label = def.options.find(o => o.value === val)?.label ?? (val as string)
  return `${def.label}: ${label}`
}

export function AddFilterButton({ defs, value, onChange, className }: AddFilterButtonProps) {
  const [open,      setOpen]      = useState(false)
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const [draft,     setDraft]     = useState<Record<string, string[]>>({})
  const [search,    setSearch]    = useState('')
  const ref = useRef<HTMLDivElement>(null)

  // Outside-click closes flyout
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // When flyout opens, snapshot all current multi values into draft
  const openFlyout = useCallback((key?: string) => {
    const snapshot: Record<string, string[]> = {}
    for (const def of defs) {
      if (def.type === 'multi') {
        snapshot[def.key] = [...((value[def.key] as string[]) ?? [])]
      }
    }
    setDraft(snapshot)
    setActiveKey(key ?? defs[0]?.key ?? null)
    setSearch('')
    setOpen(true)
  }, [defs, value])

  function closeFlyout() {
    setOpen(false)
    setActiveKey(null)
    setSearch('')
    setDraft({})
  }

  function activateDef(key: string) {
    setActiveKey(key)
    setSearch('')
  }

  // Apply staged multi selection
  function applyDraft(key: string) {
    onChange(key, draft[key] ?? [])
    closeFlyout()
  }

  function clearDraft(key: string) {
    setDraft(prev => ({ ...prev, [key]: [] }))
  }

  function toggleDraft(key: string, optValue: string) {
    setDraft(prev => {
      const cur = prev[key] ?? []
      return {
        ...prev,
        [key]: cur.includes(optValue) ? cur.filter(v => v !== optValue) : [...cur, optValue],
      }
    })
  }

  // Clear a single key (chip X)
  function clearKey(key: string, def: FilterSectionDef) {
    onChange(key, def.type === 'multi' ? [] : '')
  }

  // Clear all active keys
  function clearAll() {
    for (const def of defs) {
      onChange(def.key, def.type === 'multi' ? [] : '')
    }
  }

  // Which keys have active values
  const activeKeys = defs.filter(def => {
    const v = value[def.key]
    return def.type === 'multi' ? (v as string[])?.length > 0 : !!v
  })

  const activeDef = defs.find(d => d.key === activeKey)

  const filteredOptions = activeDef
    ? activeDef.options.filter(o =>
        !search || o.label.toLowerCase().includes(search.toLowerCase()),
      )
    : []

  return (
    <div className={cn('relative flex items-center gap-2 flex-wrap', className)} ref={ref}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => open ? closeFlyout() : openFlyout()}
        className={cn(
          'flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap',
          open || activeKeys.length > 0
            ? 'border-blue-500/40 bg-blue-500/10 text-blue-400 hover:bg-blue-500/15'
            : 'border-border bg-card/50 text-muted-foreground/70 hover:border-border-strong hover:text-foreground/80',
        )}
      >
        <SlidersHorizontal className="w-3.5 h-3.5" />
        + Add Filter
      </button>

      {/* Active filter chips */}
      {activeKeys.map(def => {
        const chipLabel = getChipLabel(def, value[def.key])
        if (!chipLabel) return null
        return (
          <span
            key={def.key}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 text-blue-400 text-xs font-medium whitespace-nowrap"
          >
            <button
              type="button"
              onClick={() => openFlyout(def.key)}
              className="hover:text-blue-200 transition-colors"
            >
              {chipLabel}
            </button>
            <button
              type="button"
              onClick={() => clearKey(def.key, def)}
              className="ml-0.5 rounded hover:text-blue-200 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        )
      })}

      {/* Clear all */}
      {activeKeys.length >= 2 && (
        <button
          type="button"
          onClick={clearAll}
          className="text-xs text-muted-foreground/50 hover:text-foreground transition-colors"
        >
          Clear all
        </button>
      )}

      {/* Two-panel flyout */}
      {open && (
        <div className="absolute left-0 top-full mt-1.5 z-50 flex rounded-xl border border-border bg-card shadow-xl overflow-hidden">

          {/* Left: dimension list */}
          <div className="w-44 border-r border-border/60 overflow-y-auto max-h-80">
            {defs.map(def => {
              const isActive = def.key === activeKey
              const hasValue = def.type === 'multi'
                ? (value[def.key] as string[])?.length > 0
                : !!value[def.key]
              return (
                <button
                  key={def.key}
                  type="button"
                  onMouseEnter={() => activateDef(def.key)}
                  onClick={() => activateDef(def.key)}
                  className={cn(
                    'flex w-full items-center justify-between px-3 py-2.5 text-left text-xs transition-colors',
                    isActive
                      ? 'bg-blue-500/15 text-blue-400'
                      : 'text-foreground/80 hover:bg-muted/50',
                  )}
                >
                  <span className={cn('font-medium', hasValue && !isActive && 'text-blue-400/80')}>
                    {def.label}
                  </span>
                  <ChevronRight className={cn('w-3 h-3 shrink-0', isActive ? 'text-blue-400' : 'text-muted-foreground/40')} />
                </button>
              )
            })}
          </div>

          {/* Right: options panel */}
          {activeDef ? (
            <div className="w-60 flex flex-col">
              {activeDef.type === 'multi' ? (
                <>
                  {/* Search */}
                  <div className="p-2 border-b border-border/60">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground/50 pointer-events-none" />
                      <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search…"
                        className="w-full pl-7 pr-3 py-1.5 text-xs bg-muted/60 border border-border rounded-lg text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-border-strong"
                        autoFocus
                      />
                    </div>
                  </div>

                  {/* Checkbox list */}
                  <div className="overflow-y-auto max-h-52 py-1">
                    {filteredOptions.length === 0 ? (
                      <p className="px-3 py-4 text-center text-xs text-muted-foreground/50">No results</p>
                    ) : (
                      filteredOptions.map(o => {
                        const checked = (draft[activeDef.key] ?? []).includes(o.value)
                        return (
                          <button
                            key={o.value}
                            type="button"
                            onClick={() => toggleDraft(activeDef.key, o.value)}
                            className={cn(
                              'flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors',
                              checked ? 'text-blue-400' : 'text-foreground/80 hover:bg-muted/40',
                            )}
                          >
                            <span className={cn(
                              'flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border',
                              checked ? 'border-blue-500 bg-blue-500' : 'border-border',
                            )}>
                              {checked && (
                                <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                                  <path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              )}
                            </span>
                            {o.label}
                          </button>
                        )
                      })
                    )}
                  </div>

                  {/* Footer: Clear + Apply */}
                  <div className="flex items-center justify-between px-3 py-2 border-t border-border/60 bg-muted/20">
                    <button
                      type="button"
                      onClick={() => clearDraft(activeDef.key)}
                      className="text-xs text-muted-foreground/60 hover:text-foreground transition-colors"
                    >
                      Clear
                    </button>
                    <button
                      type="button"
                      onClick={() => applyDraft(activeDef.key)}
                      className="px-3 py-1 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-colors"
                    >
                      Apply
                    </button>
                  </div>
                </>
              ) : (
                /* Single-select: immediate, no Apply */
                <div className="overflow-y-auto max-h-80 py-1">
                  {activeDef.options.map(o => {
                    const selected = value[activeDef.key] === o.value
                    return (
                      <button
                        key={o.value}
                        type="button"
                        onClick={() => {
                          onChange(activeDef.key, selected ? '' : o.value)
                          closeFlyout()
                        }}
                        className={cn(
                          'flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-xs transition-colors',
                          selected ? 'bg-blue-500/15 text-blue-400' : 'text-foreground/80 hover:bg-muted/40',
                        )}
                      >
                        <span className={cn(
                          'flex h-3 w-3 shrink-0 items-center justify-center rounded-full border',
                          selected ? 'border-blue-500 bg-blue-500' : 'border-border',
                        )}>
                          {selected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                        </span>
                        {o.label}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="w-60 flex items-center justify-center py-8">
              <p className="text-xs text-muted-foreground/40">Select a filter</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
