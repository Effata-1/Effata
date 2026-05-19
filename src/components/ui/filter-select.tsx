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
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          'flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-colors whitespace-nowrap',
          open ? 'bg-zinc-800 border-zinc-600 text-white' : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700',
          selected ? 'text-white' : 'text-zinc-500',
        )}
      >
        <span>{selected?.label ?? placeholder}</span>
        {open
          ? <ChevronUp   className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
          : <ChevronDown className="w-3.5 h-3.5 text-zinc-500 shrink-0" />}
      </button>

      {open && (
        <div className="absolute top-full mt-1.5 left-0 z-50 w-64 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden">
          {searchable && (
            <div className="px-3 pt-3 pb-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search..."
                  autoFocus
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-8 pr-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600"
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
                    ? 'bg-blue-600/20 text-blue-300'
                    : 'text-zinc-300 hover:bg-zinc-800/80',
                )}
              >
                <span>{opt.label}</span>
                {opt.value === value && <Check className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="px-4 py-3 text-sm text-zinc-600">No results</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Multi-select ──────────────────────────────────────────────────────────────

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
          open ? 'bg-zinc-800 border-zinc-600 text-white' : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700',
          value.length > 0 ? 'text-white' : 'text-zinc-500',
        )}
      >
        <span>{triggerLabel}</span>
        {value.length > 1 && (
          <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-blue-600 text-white text-[10px] font-bold">
            {value.length}
          </span>
        )}
        {open
          ? <ChevronUp   className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
          : <ChevronDown className="w-3.5 h-3.5 text-zinc-500 shrink-0" />}
      </button>

      {open && (
        <div className="absolute top-full mt-1.5 left-0 z-50 w-72 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden">
          {searchable && (
            <div className="px-3 pt-3 pb-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search..."
                  autoFocus
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-8 pr-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600"
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
                      ? 'bg-blue-600/20 text-blue-300'
                      : 'text-zinc-300 hover:bg-zinc-800/80',
                  )}
                >
                  <span>{opt.label}</span>
                  {selected && <Check className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
                </button>
              )
            })}
            {filtered.length === 0 && (
              <p className="px-4 py-3 text-sm text-zinc-600">No results</p>
            )}
          </div>

          {value.length > 0 && (
            <div className="flex items-center justify-between px-4 py-2.5 border-t border-zinc-800 bg-zinc-950/50">
              <span className="text-xs text-zinc-500">{value.length} selected</span>
              <button
                onClick={() => onChange([])}
                className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
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
