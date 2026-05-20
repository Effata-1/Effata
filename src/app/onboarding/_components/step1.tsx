'use client'

import { cn } from '@/lib/utils'
import { INDUSTRIES, REGIONS } from '@/lib/onboarding/data'
import type { OnboardingData } from '../types'

interface Props {
  data: OnboardingData
  onChange: (patch: Partial<OnboardingData>) => void
}

export function Step1({ data, onChange }: Props) {
  const toggleRegion = (id: string) => {
    const next = data.regions.includes(id)
      ? data.regions.filter(r => r !== id)
      : [...data.regions, id]
    onChange({ regions: next })
  }

  return (
    <div className="space-y-8">
      {/* Industry */}
      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Primary Industry</h3>
          <p className="text-xs text-muted-foreground/80 mt-0.5">Pick the one that best describes your organisation.</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-72 overflow-y-auto pr-1">
          {INDUSTRIES.map(industry => (
            <button
              key={industry.id}
              onClick={() => onChange({ industry: industry.id })}
              className={cn(
                'text-left px-3 py-2.5 rounded-lg border text-xs transition-all',
                data.industry === industry.id
                  ? 'border-blue-500 bg-blue-500/10 text-foreground'
                  : 'border-border bg-card/50 text-muted-foreground hover:border-border-strong hover:text-foreground/70'
              )}
            >
              <span className="font-medium block">{industry.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Region */}
      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Operating Regions</h3>
          <p className="text-xs text-muted-foreground/80 mt-0.5">Select all regions where you operate or have compliance obligations.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {REGIONS.map(region => (
            <button
              key={region.id}
              onClick={() => toggleRegion(region.id)}
              className={cn(
                'px-3 py-1.5 rounded-full border text-xs font-medium transition-all',
                data.regions.includes(region.id)
                  ? 'border-blue-500 bg-blue-500/15 text-blue-300'
                  : 'border-border-strong bg-card text-muted-foreground hover:border-border-strong hover:text-foreground/70'
              )}
            >
              {region.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
