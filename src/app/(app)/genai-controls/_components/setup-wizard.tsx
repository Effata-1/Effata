'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import {
  markLabelsReviewed,
  markMatrixReviewed,
  applyAppGovernanceDefaults,
  applyDataCatalogDefaults,
} from './setup-wizard-actions'

export interface StepConfig {
  id:               string
  title:            string
  description:      string
  completed:        boolean
  href:             string
  customizeLabel:   string
  defaultLabel?:    string
  defaultAction?:   'labels' | 'matrix' | 'app-governance' | 'data-catalog'
  optional?:        boolean
}

interface Props {
  steps: StepConfig[]
}

const CORE_STEPS     = 6
const OPTIONAL_STEPS = [6, 7] // 0-indexed within their section

function StepIcon({ completed, index, isNext }: { completed: boolean; index: number; isNext: boolean }) {
  if (completed) {
    return (
      <div className="shrink-0 w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
        <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
    )
  }
  if (isNext) {
    return (
      <div className="shrink-0 w-7 h-7 rounded-full bg-blue-500/20 border border-blue-500/40 flex items-center justify-center">
        <span className="text-[11px] font-bold text-blue-400">{index + 1}</span>
      </div>
    )
  }
  return (
    <div className="shrink-0 w-7 h-7 rounded-full bg-muted/40 border border-border flex items-center justify-center">
      <span className="text-[11px] font-medium text-muted-foreground/50">{index + 1}</span>
    </div>
  )
}

function StepCard({ step, index, isNext }: { step: StepConfig; index: number; isNext: boolean }) {
  const [isPending, startTransition]  = useTransition()
  const [localDone, setLocalDone]     = useState(false)
  const [feedback, setFeedback]       = useState<string | null>(null)

  const completed = step.completed || localDone

  function handleDefault() {
    setFeedback(null)
    startTransition(async () => {
      let result: { error?: string; count?: number } = {}
      if (step.defaultAction === 'labels')        result = await markLabelsReviewed()
      else if (step.defaultAction === 'matrix')   result = await markMatrixReviewed()
      else if (step.defaultAction === 'app-governance') result = await applyAppGovernanceDefaults()
      else if (step.defaultAction === 'data-catalog')   result = await applyDataCatalogDefaults()

      if (result.error) {
        setFeedback(result.error)
      } else {
        setLocalDone(true)
        if (typeof result.count === 'number' && result.count > 0) {
          setFeedback(`${result.count} items applied.`)
        }
      }
    })
  }

  return (
    <div className={cn(
      'rounded-xl border p-4 flex gap-3 transition-colors',
      completed
        ? 'border-emerald-500/20 bg-emerald-500/5'
        : isNext
          ? 'border-blue-500/25 bg-blue-500/5'
          : 'border-border bg-card/40',
    )}>
      <StepIcon completed={completed} index={index} isNext={isNext} />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className={cn(
              'text-sm font-semibold',
              completed ? 'text-emerald-400' : isNext ? 'text-foreground' : 'text-foreground/70',
            )}>
              {step.title}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
            {feedback && (
              <p className={cn('text-xs mt-1', feedback.includes('error') || step.completed ? 'text-red-400' : 'text-emerald-400/80')}>
                {feedback}
              </p>
            )}
          </div>

          {!completed && (
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              {step.defaultAction && step.defaultLabel && (
                <button
                  type="button"
                  onClick={handleDefault}
                  disabled={isPending}
                  className="px-2.5 py-1 text-xs rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isPending ? (
                    <span className="flex items-center gap-1">
                      <span className="inline-block w-2 h-2 rounded-full border border-white/40 border-t-white animate-spin" />
                      Applying…
                    </span>
                  ) : step.defaultLabel}
                </button>
              )}
              <Link
                href={step.href}
                className="px-2.5 py-1 text-xs rounded-md border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
              >
                {step.customizeLabel} →
              </Link>
            </div>
          )}

          {completed && (
            <Link
              href={step.href}
              className="shrink-0 text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors"
            >
              Edit
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

export function SetupWizard({ steps }: Props) {
  const [coreCollapsed, setCoreCollapsed] = useState(false)

  const coreSteps     = steps.slice(0, CORE_STEPS)
  const optionalSteps = steps.slice(CORE_STEPS)
  const completedCore = coreSteps.filter(s => s.completed).length
  const allCoreComplete = completedCore === CORE_STEPS
  const nextCoreIndex = coreSteps.findIndex(s => !s.completed)

  return (
    <div className="space-y-8">
      {/* Core Setup */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Core Setup</h2>
            <p className="text-xs text-muted-foreground/70 mt-0.5">
              Complete these 6 steps before generating AI policy recommendations.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-xs font-medium text-muted-foreground">
                <span className={allCoreComplete ? 'text-emerald-400' : 'text-foreground'}>{completedCore}</span>
                <span className="text-muted-foreground/50">/{CORE_STEPS}</span>
              </p>
            </div>
            {allCoreComplete && (
              <button
                type="button"
                onClick={() => setCoreCollapsed(c => !c)}
                className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors"
              >
                {coreCollapsed ? 'Show steps' : 'Collapse'}
              </button>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1 rounded-full bg-border overflow-hidden">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${(completedCore / CORE_STEPS) * 100}%` }}
          />
        </div>

        {allCoreComplete && coreCollapsed ? (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 flex items-center gap-2">
            <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm font-medium text-emerald-400">6/6 Core Setup Complete</p>
          </div>
        ) : (
          <div className="space-y-2">
            {coreSteps.map((step, i) => (
              <StepCard key={step.id} step={step} index={i} isNext={i === nextCoreIndex} />
            ))}
          </div>
        )}
      </section>

      {/* Optional Next Actions */}
      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground/80">Optional Next Actions</h2>
          <p className="text-xs text-muted-foreground/60 mt-0.5">
            Refine your policies with AI and share results with your security leadership.
          </p>
        </div>
        <div className="space-y-2">
          {optionalSteps.map((step, i) => (
            <StepCard key={step.id} step={step} index={CORE_STEPS + i} isNext={allCoreComplete && !step.completed && i === 0} />
          ))}
        </div>
      </section>
    </div>
  )
}
