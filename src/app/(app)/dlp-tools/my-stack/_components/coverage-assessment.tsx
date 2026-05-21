'use client'

import { useState, useOptimistic, useTransition } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Channel, CoverageStatus } from '@/lib/channel-taxonomy'
import type { DerivedChannelCoverage } from '@/lib/dlp-tools/derive-coverage'
import { saveChannelAssessment } from '../actions'

interface Props {
  channels: Channel[]
  channelAnswers: Record<string, Record<string, CoverageStatus>>
  derivedCoverage: DerivedChannelCoverage
}

const STATUS_OPTIONS: { value: CoverageStatus; label: string }[] = [
  { value: 'not_assessed', label: 'Not Assessed' },
  { value: 'partial',      label: 'Partial' },
  { value: 'covered',      label: 'Covered' },
]

const STATUS_STYLES: Record<CoverageStatus, string> = {
  not_assessed: 'border-border text-muted-foreground',
  partial:      'border-amber-500/30 bg-amber-500/10 text-amber-400',
  covered:      'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
}

const DERIVED_STYLES = {
  full:    'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  partial: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  addon:   'bg-blue-500/15 text-blue-400 border-blue-500/20',
  none:    'bg-red-500/15 text-red-400 border-red-500/20',
} as const

const DERIVED_LABELS = { full: 'Full', partial: 'Partial', addon: 'Add-on', none: 'Gap' }

const CHANNEL_KEY_MAP: Record<string, string> = {
  'email-dlp':              'email',
  'web-dlp':                'web',
  'saas-inline':            'saas-inline',
  'saas-api-data-at-rest':  'saas-api',
  'endpoint-device':        'endpoint',
  'genai-ai':               'genai',
  'network-protocol-egress':'network',
}

export function CoverageAssessment({ channels, channelAnswers, derivedCoverage }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [answers, setAnswers] = useState(channelAnswers)
  const [, startTransition] = useTransition()

  const [optimisticAnswers, applyOptimistic] = useOptimistic(
    answers,
    (_: typeof answers, next: typeof answers) => next,
  )

  function handleAnswer(channelSlug: string, questionKey: string, value: CoverageStatus) {
    const next = {
      ...answers,
      [channelSlug]: { ...(answers[channelSlug] ?? {}), [questionKey]: value },
    }
    setAnswers(next)
    startTransition(async () => {
      applyOptimistic(next)
      await saveChannelAssessment(channelSlug, next[channelSlug])
    })
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-foreground">Deep Assessment</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Rate your actual coverage for each channel. Answers are shared with the Channels section.
        </p>
      </div>

      <div className="rounded-xl border border-border overflow-hidden divide-y divide-border">
        {channels.map(ch => {
          const open = expanded === ch.slug
          const coverageKey = CHANNEL_KEY_MAP[ch.slug]
          const derived = coverageKey ? derivedCoverage[coverageKey as keyof DerivedChannelCoverage] : null
          const chAnswers = optimisticAnswers[ch.slug] ?? {}
          const answeredCount = Object.keys(chAnswers).filter(k => chAnswers[k] !== 'not_assessed').length
          const totalQuestions = ch.assessmentQuestions.length

          return (
            <div key={ch.slug}>
              <button
                type="button"
                onClick={() => setExpanded(open ? null : ch.slug)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors text-left"
              >
                <span className="shrink-0 text-muted-foreground/50">
                  {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </span>
                <div className="flex-1 min-w-0 flex items-center gap-3">
                  <span className="text-sm font-medium text-foreground">{ch.shortName}</span>
                  {derived && (
                    <span className={cn(
                      'px-2 py-0.5 rounded-md border text-[10px] font-semibold',
                      DERIVED_STYLES[derived.level],
                    )}>
                      {DERIVED_LABELS[derived.level]}
                    </span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground/60 shrink-0">
                  {answeredCount}/{totalQuestions} assessed
                </span>
              </button>

              {open && (
                <div className="px-11 pb-5 pt-2 space-y-4">
                  {derived && derived.coveredBy.length > 0 && (
                    <p className="text-xs text-muted-foreground/70">
                      Covered by: {derived.coveredBy.join(', ')}
                    </p>
                  )}

                  {totalQuestions === 0 ? (
                    <p className="text-xs text-muted-foreground/50 italic">No assessment questions for this channel.</p>
                  ) : (
                    <div className="space-y-4">
                      {ch.assessmentQuestions.map(q => {
                        const current = (chAnswers[q.key] ?? 'not_assessed') as CoverageStatus
                        return (
                          <div key={q.key} className="space-y-2">
                            <div>
                              <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest">{q.area}</p>
                              <p className="text-sm text-foreground/80 mt-0.5">{q.question}</p>
                            </div>
                            <div className="flex gap-2">
                              {STATUS_OPTIONS.map(opt => (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() => handleAnswer(ch.slug, q.key, opt.value)}
                                  className={cn(
                                    'px-3 py-1 rounded-md border text-xs font-medium transition-colors',
                                    current === opt.value
                                      ? STATUS_STYLES[opt.value]
                                      : 'border-border text-muted-foreground/50 hover:text-muted-foreground',
                                  )}
                                >
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
