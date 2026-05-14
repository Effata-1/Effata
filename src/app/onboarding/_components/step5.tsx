'use client'

import { cn } from '@/lib/utils'
import { DATA_CATEGORIES } from '@/lib/onboarding/data'
import type { OnboardingData } from '../types'

interface Props {
  data: OnboardingData
  onChange: (patch: Partial<OnboardingData>) => void
}

export function Step5({ data, onChange }: Props) {
  const toggleCategory = (id: string) => {
    const next = data.dataCategories.includes(id)
      ? data.dataCategories.filter(c => c !== id)
      : [...data.dataCategories, id]

    // If removing a category that's in top priorities, remove it there too
    const nextPriorities = data.topPriorities.filter(p => next.includes(p))
    onChange({ dataCategories: next, topPriorities: nextPriorities })
  }

  const togglePriority = (id: string) => {
    if (data.topPriorities.includes(id)) {
      onChange({ topPriorities: data.topPriorities.filter(p => p !== id) })
    } else if (data.topPriorities.length < 3) {
      onChange({ topPriorities: [...data.topPriorities, id] })
    }
  }

  const priorityRank = (id: string) => {
    const idx = data.topPriorities.indexOf(id)
    return idx >= 0 ? idx + 1 : null
  }

  return (
    <div className="space-y-6">
      {/* Category selection */}
      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-white">Data Types to Protect</h3>
          <p className="text-xs text-zinc-500 mt-0.5">Select all that apply to your organisation.</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-64 overflow-y-auto pr-1">
          {DATA_CATEGORIES.map(cat => {
            const selected = data.dataCategories.includes(cat.id)
            const rank = priorityRank(cat.id)
            return (
              <button
                key={cat.id}
                onClick={() => toggleCategory(cat.id)}
                className={cn(
                  'relative text-left px-3 py-2.5 rounded-lg border text-xs transition-all',
                  selected
                    ? 'border-blue-500 bg-blue-500/10 text-white'
                    : 'border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300'
                )}
              >
                <span className="font-medium block pr-5">{cat.label}</span>
                {rank && (
                  <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
                    {rank}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Top 3 priority */}
      {data.dataCategories.length >= 3 && (
        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-white">Top 3 Priorities</h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Click up to 3 selected categories to mark them as your top priorities.
              {data.topPriorities.length === 3 && (
                <span className="text-blue-400"> All 3 set.</span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {DATA_CATEGORIES.filter(c => data.dataCategories.includes(c.id)).map(cat => {
              const rank = priorityRank(cat.id)
              return (
                <button
                  key={cat.id}
                  onClick={() => togglePriority(cat.id)}
                  disabled={!rank && data.topPriorities.length >= 3}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all',
                    rank
                      ? 'border-blue-500 bg-blue-500/15 text-blue-300'
                      : 'border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-500 hover:text-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed'
                  )}
                >
                  {rank && (
                    <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
                      {rank}
                    </span>
                  )}
                  {cat.label}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
