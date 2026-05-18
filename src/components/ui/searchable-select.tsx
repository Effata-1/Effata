'use client'

import { useState, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { ChevronDown, Check, Search, X } from 'lucide-react'

export interface SelectOption {
  value: string
  label: string
}

type SearchableSelectProps =
  | {
      multiple?: false
      value: string
      onChange: (value: string) => void
      options: SelectOption[]
      placeholder?: string
      align?: 'left' | 'right'
      className?: string
    }
  | {
      multiple: true
      value: string[]
      onChange: (values: string[]) => void
      options: SelectOption[]
      placeholder?: string
      align?: 'left' | 'right'
      className?: string
    }

export function SearchableSelect(props: SearchableSelectProps) {
  const { options, placeholder = 'Select…', align = 'left', className } = props
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  // Close on click-outside and ESC
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('keydown', handleKey)
    }
  }, [])

  useEffect(() => {
    if (open) searchRef.current?.focus()
  }, [open])

  const q = search.toLowerCase()
  const filtered = q ? options.filter(o => o.label.toLowerCase().includes(q)) : options

  // Avoid unsafe casts — compute count once via proper narrowing
  const selectedCount = props.multiple ? props.value.length : 0
  const hasSelection  = selectedCount > 0

  function triggerLabel(): string {
    if (props.multiple) {
      if (props.value.length === 0) return placeholder
      if (props.value.length === 1) return options.find(o => o.value === props.value[0])?.label ?? placeholder
      return `${props.value.length} selected`
    }
    return options.find(o => o.value === props.value)?.label ?? placeholder
  }

  function handleSelect(optValue: string) {
    if (props.multiple) {
      const next = props.value.includes(optValue)
        ? props.value.filter(v => v !== optValue)
        : [...props.value, optValue]
      props.onChange(next)
    } else {
      props.onChange(optValue)
      setOpen(false)
      setSearch('')
    }
  }

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => { setOpen(v => !v); if (!open) setSearch('') }}
        className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm hover:border-zinc-700 focus:outline-none focus:border-blue-600 transition-colors min-w-[180px] w-full"
      >
        <span className={cn(
          'flex-1 text-left truncate text-sm',
          hasSelection || !props.multiple ? 'text-white' : 'text-zinc-500'
        )}>
          {triggerLabel()}
        </span>
        {hasSelection && (
          <span className="text-[10px] font-bold bg-blue-600 text-white rounded-full px-1.5 py-0.5 leading-none shrink-0 tabular-nums">
            {selectedCount}
          </span>
        )}
        <ChevronDown className={cn(
          'h-3.5 w-3.5 text-zinc-500 shrink-0 transition-transform duration-150',
          open && 'rotate-180'
        )} />
      </button>

      {open && (
        <div className={cn(
          'absolute top-full mt-1.5 w-72 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl z-50 overflow-hidden',
          align === 'right' ? 'right-0' : 'left-0'
        )}>
          {/* Search */}
          <div className="p-2 border-b border-zinc-800">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-600 pointer-events-none" />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search…"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-8 pr-7 py-1.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-blue-600"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>

          {/* Options */}
          <div className="max-h-72 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-xs text-zinc-600 px-3 py-3 text-center">No options match.</p>
            ) : (
              filtered.map(opt => {
                const isActive = props.multiple
                  ? props.value.includes(opt.value)
                  : props.value === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleSelect(opt.value)}
                    className={cn(
                      'w-full text-left px-3 py-2 text-xs transition-colors flex items-center justify-between gap-2',
                      isActive
                        ? 'bg-blue-600/20 text-blue-300'
                        : 'text-zinc-300 hover:bg-zinc-800/80'
                    )}
                  >
                    <span className="truncate">{opt.label}</span>
                    {isActive && <Check className="h-3 w-3 shrink-0 text-blue-400" />}
                  </button>
                )
              })
            )}
          </div>

          {/* Multi-select footer */}
          {props.multiple && hasSelection && (
            <div className="border-t border-zinc-800 px-3 py-2 flex items-center justify-between">
              <span className="text-[10px] text-zinc-500">{selectedCount} selected</span>
              <button
                type="button"
                onClick={() => { props.onChange([]); setSearch('') }}
                className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                <X className="h-3 w-3" />
                Clear all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
