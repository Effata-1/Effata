'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { ChevronDown, ChevronUp, Search, Check, X } from 'lucide-react'

export interface FilterOption {
  value: string
  label: string
}

// ─── Single-select ─────────────────────────────────────────────────────────────

interface SingleFilterSelectProps {
  options:     FilterOption[]
  value:       string           // '' = nothing selected (shows placeholder)
  onChange:    (value: string) => void
  placeholder: string
  searchable?: boolean
  className?:  string
}

export function FilterSelect({
  options,
  value,
  onChange,
  placeholder,
  searchable = true,
  className,
}: SingleFilterSelectProps) {
  const [open,   setOpen]   = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  const filtered = options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
  const selected = options.find(o => o.value === value)

  function handleSelect(v: string) {
    onChange(v)
    setOpen(false)
    setSearch('')
  }

  return (
    <div ref={ref} className={cn('relative', className)}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(o => !o)}
        onKeyDown={e => e.key === 'Enter' && setOpen(o => !o)}
        className={cn(
          'flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-colors whitespace-nowrap cursor-pointer select-none',
          open ? 'bg-muted border-border-strong text-foreground' : 'bg-card border-border hover:border-border-strong',
          selected ? 'text-foreground' : 'text-muted-foreground/80',
        )}
      >
        <span>{selected?.label ?? placeholder}</span>
        {selected && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onChange(''); setSearch(''); setOpen(false) }}
            className="flex items-center justify-center w-3.5 h-3.5 rounded-full text-muted-foreground/80 hover:text-foreground/90 hover:bg-accent transition-colors"
          >
            <X className="w-2.5 h-2.5" />
          </button>
        )}
        {open
          ? <ChevronUp   className="w-3.5 h-3.5 text-muted-foreground/80 shrink-0" />
          : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/80 shrink-0" />}
      </div>

      {open && (
        <div className="absolute top-full mt-1.5 left-0 z-50 w-64 bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
          {searchable && (
            <div className="px-3 pt-3 pb-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search..."
                  autoFocus
                  className="w-full bg-muted border border-border-strong rounded-lg pl-8 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-border-strong"
                />
              </div>
            </div>
          )}
          <div className="max-h-64 overflow-y-auto">
            {filtered.map(opt => (
              <button
                key={opt.value}
                onClick={() => handleSelect(opt.value)}
                className={cn(
                  'w-full flex items-center justify-between px-4 py-2.5 text-sm text-left transition-colors',
                  opt.value === value
                    ? 'bg-blue-600/20 text-blue-500'
                    : 'text-foreground/70 hover:bg-muted/80',
                )}
              >
                <span>{opt.label}</span>
                {opt.value === value && <Check className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="px-4 py-3 text-sm text-muted-foreground/60">No results</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Multi-select ─────────────────────────────────────────────────────────────

interface MultiFilterSelectProps {
  options:     FilterOption[]
  value:       string[]         // empty = nothing selected (shows placeholder)
  onChange:    (value: string[]) => void
  placeholder: string
  searchable?: boolean
  className?:  string
}

export function MultiFilterSelect({
  options,
  value,
  onChange,
  placeholder,
  searchable = true,
  className,
}: MultiFilterSelectProps) {
  const [open,   setOpen]   = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  const filtered = options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))

  const handleSelect = useCallback((v: string) => {
    onChange(value.includes(v) ? value.filter(x => x !== v) : [...value, v])
  }, [value, onChange])

  const triggerLabel = value.length === 0
    ? placeholder
    : value.length === 1
      ? (options.find(o => o.value === value[0])?.label ?? placeholder)
      : `${value.length} selected`

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          'flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-colors whitespace-nowrap',
          open ? 'bg-muted border-border-strong text-foreground' : 'bg-card border-border hover:border-border-strong',
          value.length > 0 ? 'text-foreground' : 'text-muted-foreground/80',
        )}
      >
        <span>{triggerLabel}</span>
        {value.length > 1 && (
          <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-blue-600 text-white text-[10px] font-bold">
            {value.length}
          </span>
        )}
        {open
          ? <ChevronUp   className="w-3.5 h-3.5 text-muted-foreground/80 shrink-0" />
          : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/80 shrink-0" />}
      </button>

      {open && (
        <div className="absolute top-full mt-1.5 left-0 z-50 w-72 bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
          {searchable && (
            <div className="px-3 pt-3 pb-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search..."
                  autoFocus
                  className="w-full bg-muted border border-border-strong rounded-lg pl-8 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-border-strong"
                />
              </div>
            </div>
          )}
          <div className="max-h-64 overflow-y-auto">
            {filtered.map(opt => {
              const selected = value.includes(opt.value)
              return (
                <button
                  key={opt.value}
                  onClick={() => handleSelect(opt.value)}
                  className={cn(
                    'w-full flex items-center justify-between px-4 py-2.5 text-sm text-left transition-colors',
                    selected
                      ? 'bg-blue-600/20 text-blue-500'
                      : 'text-foreground/70 hover:bg-muted/80',
                  )}
                >
                  <span>{opt.label}</span>
                  {selected && <Check className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
                </button>
              )
            })}
            {filtered.length === 0 && (
              <p className="px-4 py-3 text-sm text-muted-foreground/60">No results</p>
            )}
          </div>

          {value.length > 0 && (
            <div className="flex items-center justify-between px-4 py-2.5 border-t border-border bg-background/50">
              <span className="text-xs text-muted-foreground/80">{value.length} selected</span>
              <button
                onClick={() => onChange([])}
                className="flex items-center gap-1 text-xs text-muted-foreground/80 hover:text-foreground/70 transition-colors"
              >
                <X className="w-3 h-3" />
                Clear all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
