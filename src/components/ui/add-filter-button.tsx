'use client'

import { useState, useRef, useEffect } from 'react'
import { SlidersHorizontal, X } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── FilterChip ────────────────────────────────────────────────────────────────

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

export function AddFilterButton({ defs, value, onChange, className }: AddFilterButtonProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const activeCount = defs.reduce((n, def) => {
    const v = value[def.key]
    if (def.type === 'multi') return n + ((v as string[])?.length ?? 0)
    return n + (v ? 1 : 0)
  }, 0)

  return (
    <div className={cn('relative', className)} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={cn(
          'flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-colors',
          open || activeCount > 0
            ? 'border-blue-500/40 bg-blue-500/10 text-blue-400 hover:bg-blue-500/15'
            : 'border-border bg-card/50 text-muted-foreground/70 hover:border-border-strong hover:text-foreground/80',
        )}
      >
        <SlidersHorizontal className="w-3.5 h-3.5" />
        Add filter
        {activeCount > 0 && (
          <span className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-[10px] font-bold text-white">
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1.5 z-50 w-64 rounded-xl border border-border bg-card shadow-lg max-h-[440px] overflow-y-auto">
          {defs.map((def, i) => {
            const current = value[def.key]
            return (
              <div key={def.key}>
                {i > 0 && <div className="mx-3 border-t border-border/40" />}
                <div className="px-3 pt-3 pb-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40 mb-1.5">
                    {def.label}
                  </p>
                  <div className="space-y-0.5">
                    {def.type === 'single'
                      ? def.options.map(o => {
                          const selected = current === o.value
                          return (
                            <button
                              key={o.value}
                              type="button"
                              onClick={() => onChange(def.key, selected ? '' : o.value)}
                              className={cn(
                                'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors',
                                selected ? 'bg-blue-500/15 text-blue-400' : 'text-foreground/80 hover:bg-muted/40',
                              )}
                            >
                              <span className={cn(
                                'flex h-3 w-3 shrink-0 items-center justify-center rounded-full border',
                                selected ? 'border-blue-500 bg-blue-500' : 'border-border',
                              )}>
                                {selected && <span className="h-1 w-1 rounded-full bg-white" />}
                              </span>
                              {o.label}
                            </button>
                          )
                        })
                      : def.options.map(o => {
                          const checked = (current as string[])?.includes(o.value) ?? false
                          return (
                            <button
                              key={o.value}
                              type="button"
                              onClick={() => {
                                const prev = (current as string[]) ?? []
                                onChange(def.key, checked ? prev.filter(v => v !== o.value) : [...prev, o.value])
                              }}
                              className={cn(
                                'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors',
                                checked ? 'bg-blue-500/15 text-blue-400' : 'text-foreground/80 hover:bg-muted/40',
                              )}
                            >
                              <span className={cn(
                                'flex h-3 w-3 shrink-0 items-center justify-center rounded border',
                                checked ? 'border-blue-500 bg-blue-500' : 'border-border',
                              )}>
                                {checked && (
                                  <svg width="7" height="5" viewBox="0 0 8 6" fill="none">
                                    <path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                )}
                              </span>
                              {o.label}
                            </button>
                          )
                        })}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
