'use client'

import { cn } from '@/lib/utils'
import { COVERAGE_AREAS, COVERAGE_STATES, inferCoverageAreas } from '@/lib/onboarding/data'
import type { OnboardingData } from '../types'

interface Props {
  data: OnboardingData
  onChange: (patch: Partial<OnboardingData>) => void
}

const STATE_COLORS: Record<string, string> = {
  'actively-blocking':      'border-green-500/60 bg-green-500/10 text-green-500',
  'coach-warn':             'border-orange-500/60 bg-orange-500/10 text-orange-300',
  'monitor-alert':          'border-yellow-500/60 bg-yellow-500/10 text-yellow-300',
  'visibility-only':        'border-blue-500/60 bg-blue-500/10 text-blue-500',
  'licence-not-configured': 'border-red-500/60 bg-red-500/10 text-red-300',
  'partially-covered':      'border-purple-500/60 bg-purple-500/10 text-purple-300',
  'not-owned':              'border-border-strong bg-muted/40 text-muted-foreground/80',
  'unknown':                'border-border-strong bg-muted/40 text-muted-foreground',
  'other-state':            'border-border-strong bg-muted/40 text-muted-foreground',
}

export function Step3({ data, onChange }: Props) {
  // Build the list: inferred areas first, then any already-set areas not in inferred
  const inferred = inferCoverageAreas(data.modules)
  const allAreaIds = new Set([
    ...COVERAGE_AREAS.filter(a => inferred.has(a.id)).map(a => a.id),
    ...Object.keys(data.coverageAreas),
    ...COVERAGE_AREAS.map(a => a.id),  // show all so user can add any
  ])

  const setAreaState = (areaId: string, stateId: string) => {
    onChange({ coverageAreas: { ...data.coverageAreas, [areaId]: stateId } })
  }

  const visibleAreas = COVERAGE_AREAS.filter(a => allAreaIds.has(a.id))

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground/80">
        Based on your tool and licence selections, confirm the real configuration state for each coverage area today.
        Areas highlighted in blue were inferred from your Q2 selections.
      </p>

      <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
        {visibleAreas.map(area => {
          const isInferred = inferred.has(area.id)
          const currentState = data.coverageAreas[area.id] ?? (isInferred ? 'unknown' : 'not-owned')

          return (
            <div
              key={area.id}
              className={cn(
                'rounded-lg border px-4 py-3 transition-colors',
                isInferred ? 'border-border-strong bg-card/60' : 'border-border/50 bg-card/30'
              )}
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground">{area.label}</p>
                    {isInferred && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/20 font-medium">
                        inferred
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground/80 mt-0.5 line-clamp-1">{area.description}</p>
                </div>
              </div>

              {/* State selector */}
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {COVERAGE_STATES.map(state => (
                  <button
                    key={state.id}
                    onClick={() => setAreaState(area.id, state.id)}
                    className={cn(
                      'px-2.5 py-1 rounded-md border text-[11px] font-medium transition-all',
                      currentState === state.id
                        ? STATE_COLORS[state.id]
                        : 'border-border-strong/50 bg-transparent text-muted-foreground/60 hover:text-muted-foreground hover:border-border-strong'
                    )}
                  >
                    {state.label}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
